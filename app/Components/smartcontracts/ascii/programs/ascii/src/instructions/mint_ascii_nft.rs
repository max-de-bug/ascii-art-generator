use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::Token,
};
use mpl_token_metadata;
use crate::state::ProgramConfig;

/// Accounts for minting an ASCII art NFT
/// This instruction creates a new NFT with ASCII art metadata
#[derive(Accounts)]
#[instruction(name: String, symbol: String, uri: String)]
pub struct MintAsciiNft<'info> {
    /// Program config - provides mint fee and validates fee vault
    #[account(
        seeds = [b"config"],
        bump = config.bump,
        has_one = fee_vault,
    )]
    pub config: Account<'info, ProgramConfig>,

    /// Payer who will pay for the minting fee and account creation
    #[account(mut)]
    pub payer: Signer<'info>,

    /// Metaplex Token Metadata Program
    /// This is the Metaplex Token Metadata program ID
    /// Metaplex: metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s
    /// CHECK: Validated by address constraint to match mpl_token_metadata::ID
    #[account(address = mpl_token_metadata::ID)]
    pub token_metadata_program: UncheckedAccount<'info>,

    /// System Program - required for account creation
    /// CHECK: Validated by address constraint to match system_program::ID
    #[account(address = system_program::ID)]
    pub system_program: UncheckedAccount<'info>,

    /// Rent Sysvar - required for account size calculations
    /// CHECK: Validated by address constraint to match Rent sysvar
    /// We use UncheckedAccount to reduce stack usage
    #[account(address = anchor_lang::solana_program::sysvar::rent::id())]
    pub rent: UncheckedAccount<'info>,

    /// The mint authority PDA (controls the mint)
    /// This is a PDA that acts as the mint authority
    /// CHECK: Validated by seeds constraint - PDA derivation ensures correctness
    #[account(
        seeds = [b"mint_authority"],
        bump,
    )]
    pub mint_authority: UncheckedAccount<'info>,

    /// The mint account for the NFT
    /// Created and initialized by client via pre-instructions before this program runs
    /// The program verifies ownership by Token Program
    /// CHECK: Ownership validated in instruction handler (must be owned by Token Program)
    #[account(mut)]
    pub mint: UncheckedAccount<'info>,

    /// The associated token account for the NFT
    /// Created manually in instruction handler after mint is initialized
    /// CHECK: Created via CPI to Associated Token Program after mint initialization
    #[account(mut)]
    pub token_account: UncheckedAccount<'info>,

    /// The metadata account for the NFT (PDA)
    /// Seeds: ["metadata", token_metadata_program, mint]
    /// This account is created by Metaplex
    /// CHECK: Created and validated by Metaplex Token Metadata program via CPI
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    /// Token program - required for mint operations
    pub token_program: Program<'info, Token>,
    
    /// Associated token program - required for ATA creation
    pub associated_token_program: Program<'info, AssociatedToken>,

    /// Fee vault PDA - collects minting fees for buyback
    /// This is a PDA that holds collected fees
    #[account(
        mut,
        seeds = [b"fee_vault"],
        bump,
    )]
    pub fee_vault: SystemAccount<'info>,
}

