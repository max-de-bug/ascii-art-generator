use anchor_lang::prelude::*;

#[error_code]
pub enum AsciiError {
    #[msg("ASCII art length must be between 1 and 50000 characters")]
    InvalidLength,
    #[msg("Insufficient funds")]
    InsufficientFunds,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Invalid swap instruction data")]
    InvalidSwapData,
    #[msg("Unauthorized: Only authorized addresses can execute buyback")]
    Unauthorized,
    #[msg("Invalid token mint")]
    InvalidTokenMint,
    #[msg("Invalid WSOL account")]
    InvalidWSOLAccount,
    #[msg("Invalid name length")]
    InvalidName,
    #[msg("Invalid symbol length")]
    InvalidSymbol,
    #[msg("Invalid URI")]
    InvalidUri,
    #[msg("Slippage tolerance exceeded: output amount below minimum")]
    SlippageExceeded,
    #[msg("Swap does not use the expected WSOL account")]
    InvalidWSOLAccountInSwap,
}
