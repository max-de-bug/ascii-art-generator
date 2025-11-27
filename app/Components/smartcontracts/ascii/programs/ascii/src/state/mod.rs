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
    /// Statistics: Total number of NFTs minted (8 bytes)
    pub total_mints: u64,
    /// Statistics: Total fees collected in lamports (8 bytes)
    pub total_fees_collected: u64,
    /// Statistics: Total number of buybacks executed (8 bytes)
    pub total_buybacks_executed: u64,
    /// Statistics: Total tokens bought back (8 bytes)
    pub total_tokens_bought_back: u64,
    /// PDA bump seed (1 byte) - smallest field last
    pub bump: u8,
}

/// Fee vault account
/// Program-owned PDA that holds collected minting fees
/// This account only holds SOL (lamports), no data needed
#[account]
#[derive(InitSpace)]
pub struct FeeVault {
    // Empty struct - this account only holds SOL
    // The account space is minimal (8 bytes for discriminator)
}
