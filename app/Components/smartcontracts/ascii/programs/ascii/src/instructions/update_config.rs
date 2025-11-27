use anchor_lang::prelude::*;
use crate::{errors::AsciiError, state::ProgramConfig};

/// Accounts for updating the program configuration
/// Only the authority can call this instruction to modify config parameters
#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    /// Program config PDA - will be updated by this instruction
    #[account(
        mut,
        seeds = [b"config_v2"], // Changed from b"config" to bypass corrupted account
        bump = config.bump,
        has_one = authority @ AsciiError::Unauthorized,
    )]
    pub config: Account<'info, ProgramConfig>,

    /// Authority who can update the config (must match config.authority)
    pub authority: Signer<'info>,
}

