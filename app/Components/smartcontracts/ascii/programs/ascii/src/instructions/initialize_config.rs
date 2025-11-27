use anchor_lang::prelude::*;
use crate::state::{ProgramConfig, FeeVault};

/// Accounts for initializing the program configuration
/// This instruction should be called once after deployment to set up the program
#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    /// Program config PDA - will be initialized by this instruction
    #[account(
        init,
        payer = authority,
        space = 8 + ProgramConfig::INIT_SPACE,
        seeds = [b"config_v2"], // Changed from b"config" to bypass corrupted account
        bump
    )]
    pub config: Account<'info, ProgramConfig>,

    /// Authority who will control the program (signer)
    #[account(mut)]
    pub authority: Signer<'info>,

    /// Fee vault PDA - program-owned account that holds collected fees
    /// Will be created automatically if it doesn't exist (best practice)
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + FeeVault::INIT_SPACE,
        seeds = [b"fee_vault"],
        bump
    )]
    pub fee_vault: Account<'info, FeeVault>,

    /// System program - required for account initialization
    pub system_program: Program<'info, System>,
}

