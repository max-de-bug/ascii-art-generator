use anchor_lang::prelude::*;

/// Program configuration account
/// Stores all configurable parameters and keys for easy lookup
/// 
/// Field ordering: Fixed-size fields first, ordered by size (largest to smallest)
#[account]
#[derive(InitSpace)]
pub struct ProgramConfig {
    /// Authority who can execute buybacks and update config (32 bytes)
    pub authority: Pubkey,
    /// Fee vault PDA address (32 bytes)
    pub fee_vault: Pubkey,
    /// Token mint address to buy back (32 bytes)
    pub buyback_token_mint: Pubkey,
    /// Treasury address where bought tokens go (32 bytes)
    pub treasury: Pubkey,
    /// Minting fee in lamports (8 bytes)
    pub mint_fee: u64,
    /// Minimum SOL amount for buyback execution (8 bytes)
    pub min_buyback_amount: u64,
    /// PDA bump seed (1 byte) - smallest field last
    pub bump: u8,
}
