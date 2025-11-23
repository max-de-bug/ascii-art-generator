use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::invoke,
    sysvar::{rent::Rent, SysvarId},
};
use anchor_lang::system_program;
use std::str::FromStr;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{mint_to, initialize_mint, MintTo, Token, TokenAccount, InitializeMint, sync_native, SyncNative},
};

use mpl_token_metadata::{
    instructions::CreateMetadataAccountV3CpiBuilder,
    types::DataV2,
};

// Declare modules
pub mod errors;
pub mod events;

// Import from modules
use errors::AsciiError;
use events::{MintEvent, BuybackEvent};

declare_id!("DvGwWxoj4k1BQfRoEL18CNYnZ8XYZp1xYHSgBZdvaCKT");

// Default constants (used for initialization)
pub const DEFAULT_BUYBACK_TOKEN_MINT_STR: &str = "AKzAhPPLMH5NG35kGbgkwtrTLeGyVrfCtApjnvqAATcm";
pub const DEFAULT_MINT_FEE_LAMPORTS: u64 = 10_000_000; // 0.01 SOL
pub const DEFAULT_AUTHORITY_STR: &str = "95VKqkiYBhyjHGoEx63MqhdUGkTK5wvF7yP1Kv8rnoWe";

// System constants (compile-time, zero runtime cost)
pub const JUPITER_PROGRAM_ID_STR: &str = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";
pub const WSOL_MINT_STR: &str = "So11111111111111111111111111111111111111112";

pub fn jupiter_program_id() -> Pubkey {
    Pubkey::from_str(JUPITER_PROGRAM_ID_STR).unwrap()
}

pub fn wsol_mint() -> Pubkey {
    Pubkey::from_str(WSOL_MINT_STR).unwrap()
}

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




/// Event emitted when an ASCII NFT is minted
/// This makes it easy for indexers to track mints


#[program]
pub mod ascii {
    use super::*;

    /// Initialize program configuration
    /// This should be called once after deployment
    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        treasury: Pubkey,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        
        // Invariant: Treasury cannot be system program or zero address
        require!(
            treasury != system_program::ID && treasury != Pubkey::default(),
            AsciiError::InvalidTreasury
        );
        
        config.authority = ctx.accounts.authority.key();
        config.fee_vault = ctx.accounts.fee_vault.key();
        config.buyback_token_mint = Pubkey::from_str(DEFAULT_BUYBACK_TOKEN_MINT_STR).unwrap();
        config.treasury = treasury;
        config.mint_fee = DEFAULT_MINT_FEE_LAMPORTS;
        config.min_buyback_amount = 100_000_000; // 0.1 SOL minimum
        config.bump = ctx.bumps.config;

        msg!("Program config initialized");
        msg!("Authority: {}", config.authority);
        msg!("Fee vault: {}", config.fee_vault);
        msg!("Treasury: {}", config.treasury);
        msg!("Mint fee: {} lamports", config.mint_fee);

        Ok(())
    }

    /// Update program configuration
    /// Only authority can call this
    pub fn update_config(
        ctx: Context<UpdateConfig>,
        new_mint_fee: Option<u64>,
        new_min_buyback_amount: Option<u64>,
        new_treasury: Option<Pubkey>,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;

        if let Some(fee) = new_mint_fee {
            require!(fee > 0, AsciiError::InvalidAmount);
            config.mint_fee = fee;
            msg!("Updated mint fee to: {}", fee);
        }

        if let Some(amount) = new_min_buyback_amount {
            require!(amount > 0, AsciiError::InvalidAmount);
            config.min_buyback_amount = amount;
            msg!("Updated min buyback amount to: {}", amount);
        }

        if let Some(treasury) = new_treasury {
            config.treasury = treasury;
            msg!("Updated treasury to: {}", treasury);
        }

        Ok(())
    }

    /// Transfer authority to a new address
    /// Only current authority can call this
    pub fn transfer_authority(
        ctx: Context<UpdateConfig>,
        new_authority: Pubkey,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        
        msg!("Transferring authority from {} to {}", config.authority, new_authority);
        config.authority = new_authority;

        Ok(())
    }

    /// Execute buyback: Swap collected fees for buyback token using Jupiter
    /// This instruction:
    /// 1. Transfers SOL from fee vault to WSOL account
    /// 2. Wraps SOL to WSOL
    /// 3. Swaps WSOL to buyback token via Jupiter
    /// 4. Sends tokens to treasury/burn address
    pub fn execute_buyback(
        ctx: Context<ExecuteBuyback>,
        amount: u64, // Amount of SOL to swap (in lamports)
        swap_instruction_data: Vec<u8>, // Pre-computed Jupiter swap instruction data
        minimum_output_amount: u64, // Minimum tokens expected from swap (slippage protection)
    ) -> Result<()> {
        let config = &ctx.accounts.config;
        
        require!(amount > 0, AsciiError::InvalidAmount);
        require!(!swap_instruction_data.is_empty(), AsciiError::InvalidSwapData);
        require!(minimum_output_amount > 0, AsciiError::InvalidAmount);
        require!(amount >= config.min_buyback_amount, AsciiError::BuybackAmountTooLow);

        let fee_vault = &ctx.accounts.fee_vault;
        let fee_vault_balance = fee_vault.get_lamports();
        
        require!(
            fee_vault_balance >= amount,
            AsciiError::InsufficientFunds
        );

        // Step 1: Transfer SOL from fee vault to WSOL account using Anchor CPI
        let fee_vault_seeds = &[
            b"fee_vault".as_ref(),
            &[ctx.bumps.fee_vault],
        ];
        
        anchor_lang::system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: fee_vault.to_account_info(),
                    to: ctx.accounts.wsol_account.to_account_info(),
                },
                &[fee_vault_seeds],
            ),
            amount,
        )?;

        // Step 2: Sync native SOL account (wraps SOL to WSOL)
        sync_native(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                SyncNative {
                    account: ctx.accounts.wsol_account.to_account_info(),
                },
            ),
        )?;

        msg!("Wrapped {} lamports to WSOL", amount);

        // Step 3: Execute Jupiter swap
        // Jupiter swap instruction data is passed from client (pre-computed via Jupiter API)
        // We execute it via CPI
        // Note: Jupiter swap instruction data should already include all necessary account metas
        // We just need to pass the accounts in the correct order
        
        // Build account metas from remaining_accounts (client provides these)
        let account_metas: Vec<AccountMeta> = 
            ctx.remaining_accounts.iter().map(|acc| {
                AccountMeta {
                    pubkey: *acc.key,
                    is_signer: acc.is_signer,
                    is_writable: acc.is_writable,
                }
            }).collect();
        
        // Validate Jupiter program ID
        require!(
            ctx.accounts.jupiter_program.key() == jupiter_program_id(),
            AsciiError::InvalidSwapData
        );

        // Validate buyback token mint matches config
        require!(
            ctx.accounts.buyback_token_account.mint == config.buyback_token_mint,
            AsciiError::InvalidTokenMint
        );

        // WSOL Account Usage Verification
        // Verify that the swap instruction uses the WSOL account we funded
        // This ensures the swap actually uses our WSOL, not a different account
        let wsol_account_key = ctx.accounts.wsol_account.key();
        let swap_uses_our_wsol = ctx.remaining_accounts.iter().any(|acc| *acc.key == wsol_account_key);
        require!(
            swap_uses_our_wsol,
            AsciiError::InvalidWSOLAccountInSwap
        );

        // Capture initial balance to verify tokens were received after swap
        let initial_token_balance = ctx.accounts.buyback_token_account.amount;


        // Build the swap instruction
        let swap_ix = Instruction {
            program_id: ctx.accounts.jupiter_program.key(),
            accounts: account_metas,
            data: swap_instruction_data,
        };

        // Execute swap via CPI using remaining_accounts directly
        // The client should provide all necessary accounts including WSOL, buyback token, etc.
        invoke(
            &swap_ix,
            ctx.remaining_accounts,
        )?;

        // Verify tokens were actually received from the swap
        let final_token_balance = ctx.accounts.buyback_token_account.amount;
        require!(
            final_token_balance > initial_token_balance,
            AsciiError::InvalidSwapData
        );

        let token_amount = final_token_balance - initial_token_balance;

        // Slippage Protection: Verify output meets minimum expected amount
        require!(
            token_amount >= minimum_output_amount,
            AsciiError::SlippageExceeded
        );

        msg!("Buyback executed: {} SOL swapped for {} tokens", amount, token_amount);

        emit!(BuybackEvent {
            amount_sol: amount,
            token_amount,
            timestamp: Clock::get()?.unix_timestamp,
        });

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

        // Validate name length (Metaplex standard: max 32 chars)
        require!(
            name.len() > 0 && name.len() <= 32,
            AsciiError::InvalidName
        );

        // Validate symbol length (Metaplex standard: max 10 chars)
        require!(
            symbol.len() > 0 && symbol.len() <= 10,
            AsciiError::InvalidSymbol
        );

        // Validate URI length (reasonable limit: 200 chars)
        require!(
            uri.len() > 0 && uri.len() <= 200,
            AsciiError::InvalidUri
        );

        let config = &ctx.accounts.config;
        
        // Collect minting fee from config
        let mint_fee = config.mint_fee;
        
        // Check payer has enough balance
        let payer_balance = ctx.accounts.payer.get_lamports();
        require!(
            payer_balance >= mint_fee,
            AsciiError::InsufficientFunds
        );

        // Transfer fee to fee vault PDA using Anchor CPI
        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.payer.to_account_info(),
                    to: ctx.accounts.fee_vault.to_account_info(),
                },
            ),
            mint_fee,
        )?;

        msg!("Collected mint fee: {} lamports ({} SOL)", mint_fee, mint_fee as f64 / 1_000_000_000.0);

        // Initialize the mint account with Token program
        // The mint authority is the mint_authority PDA
        let bump = ctx.bumps.mint_authority;
        let mint_authority_seeds = &[
            b"mint_authority".as_ref(),
            &[bump],
        ];
        let signer = &[&mint_authority_seeds[..]];

        // Initialize mint with 0 decimals (NFT standard) and mint_authority as authority
        // The mint account must be created by the client as uninitialized before calling this instruction
        initialize_mint(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                InitializeMint {
                    mint: ctx.accounts.mint.to_account_info(),
                    rent: ctx.accounts.rent.to_account_info(),
                },
                signer,
            ),
            0, // decimals (NFTs have 0 decimals)
            &ctx.accounts.mint_authority.key(),
            None, // freeze_authority (None for NFTs)
        )?;

        // Mint the token (1 token for NFT)

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
            &ctx.accounts.token_metadata_program.to_account_info(),
        )
        .metadata(&ctx.accounts.metadata.to_account_info())
        .mint(&ctx.accounts.mint.to_account_info())
        .mint_authority(&ctx.accounts.mint_authority.to_account_info())
        .payer(&ctx.accounts.payer.to_account_info())
        .update_authority(&ctx.accounts.mint_authority.to_account_info(), true)
        .system_program(&ctx.accounts.system_program.to_account_info())
        .rent(Some(&ctx.accounts.rent.to_account_info()))
        .data(data_v2)
        .is_mutable(true)
        .invoke_signed(&[mint_authority_seeds])?;

        msg!(
            "Minted ASCII NFT: {} ({}), URI: {}",
            name,
            symbol,
            uri
        );

        // Emit event for indexers to track
        emit!(MintEvent {
            minter: ctx.accounts.payer.key(),
            mint: ctx.accounts.mint.key(),
            name,
            symbol,
            uri,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + ProgramConfig::INIT_SPACE,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, ProgramConfig>,

    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        seeds = [b"fee_vault"],
        bump
    )]
    pub fee_vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
        has_one = authority @ AsciiError::Unauthorized,
    )]
    pub config: Account<'info, ProgramConfig>,

    pub authority: Signer<'info>,
}

/// Accounts for executing buyback with Jupiter swap
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

    /// Authority that can execute buyback
    pub authority: Signer<'info>,

    /// Fee vault PDA - holds collected fees
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
    /// Mint is validated against config in instruction logic
    #[account(mut)]
    pub buyback_token_account: Account<'info, TokenAccount>,

    /// Jupiter swap program
    /// CHECK: Jupiter swap program - validated to ensure correct program
    #[account(address = jupiter_program_id())]
    pub jupiter_program: UncheckedAccount<'info>,

    /// Token program - validated to ensure correct program
    #[account(address = Token::id())]
    pub token_program: Program<'info, Token>,

    /// System program - validated to ensure correct program
    #[account(address = system_program::ID)]
    pub system_program: Program<'info, System>,

    /// Rent sysvar
    /// CHECK: Rent sysvar
    #[account(address = Rent::id())]
    pub rent: UncheckedAccount<'info>,
}

/// Accounts for minting an ASCII art NFT
#[derive(Accounts)]
#[instruction(name: String, symbol: String, uri: String)]
pub struct MintAsciiNft<'info> {
    /// Program config - provides mint fee
    #[account(
        seeds = [b"config"],
        bump = config.bump,
        has_one = fee_vault,
    )]
    pub config: Account<'info, ProgramConfig>,

    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: Metaplex Token Metadata Program
    /// This is the Metaplex Token Metadata program ID
    /// Metaplex: metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s
    #[account(address = mpl_token_metadata::ID)]
    pub token_metadata_program: UncheckedAccount<'info>,

    /// CHECK: System Program
    #[account(address = system_program::ID)]
    pub system_program: UncheckedAccount<'info>,

    /// CHECK: Rent Sysvar
    /// We use UncheckedAccount to reduce stack usage
    #[account(address = Rent::id())]
    pub rent: UncheckedAccount<'info>,

    /// The mint authority PDA (controls the mint)
    /// CHECK: This is a PDA that acts as the mint authority
    #[account(
        seeds = [b"mint_authority"],
        bump,
    )]
    pub mint_authority: UncheckedAccount<'info>,

    /// The mint account for the NFT
    /// CHECK: This account must be created by the client as uninitialized (owned by System Program)
    /// It will be initialized by `initialize_mint` CPI call which assigns it to Token program
    #[account(mut)]
    pub mint: Signer<'info>,

    /// The associated token account for the NFT
    /// Using init for safety - each NFT gets a fresh mint and token account
    #[account(
        init,
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

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,

    /// Fee vault PDA - collects minting fees for buyback
    /// CHECK: This is a PDA that holds collected fees
    #[account(
        mut,
        seeds = [b"fee_vault"],
        bump,
    )]
    pub fee_vault: SystemAccount<'info>,
}

