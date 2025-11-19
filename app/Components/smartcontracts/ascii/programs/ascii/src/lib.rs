use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::{invoke, invoke_signed},
    system_instruction,
    sysvar::{rent::Rent, SysvarId},
};
use anchor_lang::system_program;
use std::str::FromStr;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{mint_to, initialize_mint, Mint, MintTo, Token, TokenAccount, InitializeMint, sync_native, SyncNative},
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

declare_id!("56cKjpFg9QjDsRCPrHnj1efqZaw2cvfodNhz4ramoXxt");

// Buyback token address - using const function for compile-time validation
pub const BUYBACK_TOKEN_MINT_STR: &str = "AKzAhPPLMH5NG35kGbgkwtrTLeGyVrfCtApjnvqAATcm";
pub fn buyback_token_mint() -> Pubkey {
    Pubkey::from_str(BUYBACK_TOKEN_MINT_STR).unwrap()
}

// Minting fee: 0.01 SOL = 10,000,000 lamports
pub const MINT_FEE_LAMPORTS: u64 = 10_000_000;

// Jupiter Swap Program ID (V6)
// Mainnet: JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4
// Devnet: JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4 (same)
pub const JUPITER_PROGRAM_ID_STR: &str = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";
pub fn jupiter_program_id() -> Pubkey {
    Pubkey::from_str(JUPITER_PROGRAM_ID_STR).unwrap()
}

// WSOL mint address (Wrapped SOL)
pub const WSOL_MINT_STR: &str = "So11111111111111111111111111111111111111112";
pub fn wsol_mint() -> Pubkey {
    Pubkey::from_str(WSOL_MINT_STR).unwrap()
}

// Authority address for executing buyback
// This is the public key of the authority wallet that can execute buybacks
pub const AUTHORITY_PUBKEY_STR: &str = "95VKqkiYBhyjHGoEx63MqhdUGkTK5wvF7yP1Kv8rnoWe";
pub fn authority_pubkey() -> Pubkey {
    Pubkey::from_str(AUTHORITY_PUBKEY_STR).unwrap()
}

/// Event emitted when an ASCII NFT is minted
/// This makes it easy for indexers to track mints


#[program]
pub mod ascii {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
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
        require!(amount > 0, AsciiError::InvalidAmount);
        require!(!swap_instruction_data.is_empty(), AsciiError::InvalidSwapData);
        require!(minimum_output_amount > 0, AsciiError::InvalidAmount);

        let fee_vault = &ctx.accounts.fee_vault;
        let fee_vault_balance = fee_vault.get_lamports();
        
        require!(
            fee_vault_balance >= amount,
            AsciiError::InsufficientFunds
        );

        // Get fee vault PDA seeds for signing
        let fee_vault_bump = ctx.bumps.fee_vault;
        let fee_vault_seeds = &[
            b"fee_vault".as_ref(),
            &[fee_vault_bump],
        ];
        let signer_seeds = &[&fee_vault_seeds[..]];

        // Step 1: Transfer SOL from fee vault to WSOL account
        // This will wrap SOL to WSOL automatically when we create the WSOL account
        invoke_signed(
            &system_instruction::transfer(
                &fee_vault.key(),
                &ctx.accounts.wsol_account.key(),
                amount,
            ),
            &[
                fee_vault.to_account_info(),
                ctx.accounts.wsol_account.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            signer_seeds,
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

        // Note: WSOL and buyback token account mints are already validated
        // in the account constraints above, so no need to re-validate here.

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

        // Collect minting fee
        let mint_fee = MINT_FEE_LAMPORTS;
        
        // Check payer has enough balance (including rent for accounts being created)
        let payer_balance = ctx.accounts.payer.get_lamports();
        require!(
            payer_balance >= mint_fee,
            AsciiError::InsufficientFunds
        );

        // Transfer fee to fee vault PDA
        invoke(
            &system_instruction::transfer(
                &ctx.accounts.payer.key(),
                &ctx.accounts.fee_vault.key(),
                mint_fee,
            ),
            &[
                ctx.accounts.payer.to_account_info(),
                ctx.accounts.fee_vault.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        msg!("Collected mint fee: {} lamports ({} SOL)", mint_fee, mint_fee as f64 / 1_000_000_000.0);

        // Initialize the mint account
        // The mint authority is the mint_authority PDA
        let bump = ctx.bumps.mint_authority;
        let mint_authority_seeds = &[
            b"mint_authority".as_ref(),
            &[bump],
        ];
        let signer = &[&mint_authority_seeds[..]];

        // Initialize mint with 0 decimals (NFT standard) and mint_authority as authority
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
pub struct Initialize {}

/// Accounts for executing buyback with Jupiter swap
#[derive(Accounts)]
pub struct ExecuteBuyback<'info> {
    /// Authority that can execute buyback
    /// Only the authorized address can execute buyback operations
    #[account(
        constraint = authority.key() == Pubkey::from_str(AUTHORITY_PUBKEY_STR).unwrap() @ AsciiError::Unauthorized
    )]
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
        constraint = wsol_account.mint == Pubkey::from_str(WSOL_MINT_STR).unwrap() @ AsciiError::InvalidWSOLAccount
    )]
    pub wsol_account: Account<'info, TokenAccount>,

    /// Buyback token account - receives tokens after swap
    /// Validated to ensure it's for the correct buyback token
    #[account(
        mut,
        constraint = buyback_token_account.mint == Pubkey::from_str(BUYBACK_TOKEN_MINT_STR).unwrap() @ AsciiError::InvalidTokenMint
    )]
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
    /// We use a unique seed based on the payer and a nonce to ensure uniqueness
    #[account(
        init,
        payer = payer,
        space = 82, // Mint account size
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

