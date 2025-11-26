use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{Token, TokenAccount};
use crate::{errors::AsciiError, state::ProgramConfig, constants::{jupiter_program_id, wsol_mint}};

/// Accounts for executing buyback with Jupiter swap
/// This instruction converts collected fees (SOL) into buyback tokens via Jupiter DEX
#[derive(Accounts)]
pub struct ExecuteBuyback<'info> {
    /// Program config - validates authority and provides settings
    #[account(
        seeds = [b"config"],
        bump = config.bump,
        has_one = authority @ AsciiError::Unauthorized,
        has_one = fee_vault,
    )]
    pub config: Account<'info, ProgramConfig>,

    /// Authority that can execute buyback (must match config.authority)
    pub authority: Signer<'info>,

    /// Fee vault PDA - holds collected fees, will be debited
    #[account(
        mut,
        seeds = [b"fee_vault"],
        bump,
    )]
    pub fee_vault: SystemAccount<'info>,

    /// WSOL account (wrapped SOL) - receives SOL and wraps it
    /// This account will hold WSOL before swap
    /// Validated to ensure it's actually a WSOL account
    #[account(
        mut,
        constraint = wsol_account.mint == wsol_mint() @ AsciiError::InvalidWSOLAccount
    )]
    pub wsol_account: Account<'info, TokenAccount>,

    /// Buyback token account - receives tokens after swap
    /// Mint is validated against config to ensure correct token
    #[account(
        mut,
        constraint = buyback_token_account.mint == config.buyback_token_mint @ AsciiError::InvalidTokenMint
    )]
    pub buyback_token_account: Account<'info, TokenAccount>,

    /// Jupiter swap program - validated to ensure correct program
    /// CHECK: Validated by address constraint to match jupiter_program_id()
    #[account(address = jupiter_program_id())]
    pub jupiter_program: UncheckedAccount<'info>,

    /// Token program - validated to ensure correct program
    #[account(address = Token::id())]
    pub token_program: Program<'info, Token>,

    /// System program - validated to ensure correct program
    #[account(address = system_program::ID)]
    pub system_program: Program<'info, System>,

    /// Rent sysvar - required for account operations
    /// CHECK: Validated by address constraint to match Rent sysvar
    #[account(address = anchor_lang::solana_program::sysvar::rent::id())]
    pub rent: UncheckedAccount<'info>,
}

