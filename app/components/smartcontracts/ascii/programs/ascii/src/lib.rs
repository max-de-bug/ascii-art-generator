use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{mint_to, Mint, MintTo, Token, TokenAccount},
};
use mpl_token_metadata::{
    instructions::CreateMetadataAccountV3CpiBuilder,
    types::DataV2,
};

declare_id!("56cKjpFg9QjDsRCPrHnj1efqZaw2cvfodNhz4ramoXxt");

#[program]
pub mod ascii {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }

    /// Mint an ASCII art NFT
    /// 
    /// This instruction:
    /// 1. Validates the ASCII art (length, content)
    /// 2. Creates a new mint
    /// 3. Mints the NFT token
    /// 4. Creates metadata using Metaplex
    /// 5. Tracks mint count in program state
    pub fn mint_ascii_nft(
        ctx: Context<MintAsciiNft>,
        name: String,
        symbol: String,
        uri: String, // IPFS URI for metadata JSON
        ascii_length: u32, // Length of ASCII art for validation
    ) -> Result<()> {
        // Custom validation: Check ASCII art length
        require!(
            ascii_length > 0 && ascii_length <= 50000,
            AsciiError::InvalidLength
        );

        // Update global mint count in program state
        let mint_state = &mut ctx.accounts.mint_state;
        mint_state.total_minted = mint_state.total_minted.checked_add(1).unwrap();
        mint_state.last_mint = Clock::get()?.unix_timestamp;

        // Update user-specific state (mint count and level)
        let user_state = &mut ctx.accounts.user_state;
        
        // Initialize user field if this is the first mint (account was just created)
        if user_state.user == Pubkey::default() {
            user_state.user = ctx.accounts.payer.key();
            user_state.mint_count = 0;
            user_state.level = 1;
        }
        
        user_state.mint_count = user_state.mint_count.checked_add(1).unwrap();
        user_state.last_mint = Clock::get()?.unix_timestamp;
        
        // Calculate level based on mint count
        // Level formula: level = sqrt(mint_count / 5) + 1
        // This creates a progression where:
        // - Level 1: 0-4 mints
        // - Level 2: 5-19 mints
        // - Level 3: 20-44 mints
        // - Level 4: 45-79 mints
        // - Level 5: 80-124 mints
        // - etc.
        let level = calculate_level(user_state.mint_count);
        let old_level = user_state.level;
        user_state.level = level;

        // Mint the token (1 token for NFT)
        // The mint authority is the mint_authority PDA
        let mint_authority_seeds = &[
            b"mint_authority",
            &[ctx.bumps.mint_authority],
        ];
        let signer = &[&mint_authority_seeds[..]];

        mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.token_account.to_account_info(),
                    authority: ctx.accounts.mint_authority.to_account_info(),
                },
                signer,
            ),
            1, // NFTs always have supply of 1
        )?;

        // Create metadata using Metaplex CPI
        let creator = vec![mpl_token_metadata::types::Creator {
            address: ctx.accounts.payer.key(),
            verified: true,
            share: 100,
        }];

        let data_v2 = DataV2 {
            name: name.clone(),
            symbol: symbol.clone(),
            uri: uri.clone(),
            seller_fee_basis_points: 0,
            creators: Some(creator),
            collection: None,
            uses: None,
        };

        CreateMetadataAccountV3CpiBuilder::new(
            ctx.accounts.token_metadata_program.key(),
        )
        .metadata(&ctx.accounts.metadata.key())
        .mint(ctx.accounts.mint.key(), false)
        .mint_authority(&ctx.accounts.mint_authority.key(), true)
        .payer(&ctx.accounts.payer.key())
        .update_authority(&ctx.accounts.mint_authority.key(), true)
        .system_program(&ctx.accounts.system_program.key())
        .rent(Some(&ctx.accounts.rent.key()))
        .data(data_v2)
        .is_mutable(true)
        .invoke_signed(&[mint_authority_seeds])?;

        // Log level up if user leveled up
        if level > old_level {
            msg!(
                "🎉 Level up! User {} reached level {}!",
                ctx.accounts.payer.key(),
                level
            );
        }

        msg!(
            "Minted ASCII NFT: {} ({}), URI: {}, Total minted: {}, User level: {} ({} mints)",
            name,
            symbol,
            uri,
            mint_state.total_minted,
            user_state.level,
            user_state.mint_count
        );

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}

/// Accounts for minting an ASCII art NFT
#[derive(Accounts)]
#[instruction(name: String, symbol: String, uri: String)]
pub struct MintAsciiNft<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: Metaplex Token Metadata Program
    /// This is the Metaplex Token Metadata program ID
    /// Metaplex: metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s
    #[account(address = mpl_token_metadata::ID)]
    pub token_metadata_program: UncheckedAccount<'info>,

    /// CHECK: System Program
    #[account(address = anchor_lang::system_program::ID)]
    pub system_program: UncheckedAccount<'info>,

    /// CHECK: Rent Sysvar
    pub rent: UncheckedAccount<'info>,

    /// The mint authority PDA (controls the mint)
    /// CHECK: This is a PDA that acts as the mint authority
    #[account(
        seeds = [b"mint_authority"],
        bump,
    )]
    pub mint_authority: UncheckedAccount<'info>,

    /// The mint account for the NFT
    /// We use a unique seed based on the payer and a nonce to ensure uniqueness
    #[account(
        init,
        payer = payer,
        mint::decimals = 0,
        mint::authority = mint_authority,
    )]
    pub mint: Account<'info, Mint>,

    /// The associated token account for the NFT
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = payer,
    )]
    pub token_account: Account<'info, TokenAccount>,

    /// The metadata account for the NFT (PDA)
    /// Seeds: ["metadata", token_metadata_program, mint]
    /// CHECK: This account is created by Metaplex
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    /// Program state to track global minting statistics
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + MintState::LEN,
        seeds = [b"mint_state"],
        bump,
    )]
    pub mint_state: Account<'info, MintState>,

    /// User-specific state to track per-user mint count and level
    /// PDA derived from: ["user_state", payer]
    /// This allows each user to have their own leveling progress
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + UserState::LEN,
        seeds = [b"user_state", payer.key().as_ref()],
        bump,
    )]
    pub user_state: Account<'info, UserState>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

/// Program state to track global minting statistics
#[account]
pub struct MintState {
    pub total_minted: u64,
    pub last_mint: i64,
}

impl MintState {
    pub const LEN: usize = 8 + 8; // discriminator + u64 + i64
}

/// User-specific state to track per-user mint count and level
/// Each user has their own UserState account (PDA)
#[account]
pub struct UserState {
    pub user: Pubkey,        // The user's public key
    pub mint_count: u64,     // Number of NFTs this user has minted
    pub level: u8,           // Current level (calculated from mint_count)
    pub last_mint: i64,      // Unix timestamp of last mint
}

impl UserState {
    pub const LEN: usize = 32 + 8 + 1 + 8; // discriminator + Pubkey(32) + u64(8) + u8(1) + i64(8)
}

/// Calculate user level based on mint count
/// Level formula: level = sqrt(mint_count / 5) + 1
/// This creates a progression where higher levels require more mints
fn calculate_level(mint_count: u64) -> u8 {
    if mint_count == 0 {
        return 1;
    }
    
    // Use integer square root for efficiency
    // level = sqrt(mint_count / 5) + 1
    let level_f64 = ((mint_count as f64) / 5.0).sqrt() + 1.0;
    let level = level_f64 as u8;
    
    // Ensure minimum level of 1 and maximum level of 255
    level.max(1).min(255)
}

#[error_code]
pub enum AsciiError {
    #[msg("ASCII art length must be between 1 and 50000 characters")]
    InvalidLength,
}
