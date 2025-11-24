use anchor_lang::prelude::*;
use crate::state::ProgramConfig;

/// Accounts for initializing the program configuration
/// This instruction should be called once after deployment to set up the program
#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    /// Program config PDA - will be initialized by this instruction
    #[account(
        init,
        payer = authority,
        space = 8 + ProgramConfig::INIT_SPACE,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, ProgramConfig>,

    /// Authority who will control the program (signer)
    #[account(mut)]
    pub authority: Signer<'info>,

    /// Fee vault PDA - validated to ensure it exists
    #[account(
        seeds = [b"fee_vault"],
        bump
    )]
    pub fee_vault: SystemAccount<'info>,

    /// System program - required for account initialization
    pub system_program: Program<'info, System>,
}

