use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::invoke,
};
use anchor_lang::system_program;
use std::str::FromStr;
use anchor_spl::token::{mint_to, MintTo, sync_native, SyncNative};
use mpl_token_metadata::{
    instructions::CreateMetadataAccountV3CpiBuilder,
    types::DataV2,
};

// Declare modules
pub mod errors;
pub mod events;
pub mod state;
pub mod instructions;
pub mod constants;

// Import from modules
use errors::AsciiError;
use events::{MintEvent, BuybackEvent};
use instructions::*;
use constants::*;

declare_id!("DvGwWxoj4k1BQfRoEL18CNYnZ8XYZp1xYHSgBZdvaCKT");

#[program]
pub mod ascii {
    use super::*;

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
        
        // Fee vault is created automatically by Anchor if it doesn't exist (init_if_needed)
        // This is the standard Anchor pattern for program-owned PDAs
        
        config.authority = ctx.accounts.authority.key();
        config.fee_vault = ctx.accounts.fee_vault.key();
        config.buyback_token_mint = Pubkey::from_str(DEFAULT_BUYBACK_TOKEN_MINT_STR).unwrap();
        config.treasury = treasury;
        config.mint_fee = DEFAULT_MINT_FEE_LAMPORTS;
        config.min_buyback_amount = MIN_BUYBACK_AMOUNT;
        
        // Initialize statistics to zero
        config.total_mints = 0;
        config.total_fees_collected = 0;
        config.total_buybacks_executed = 0;
        config.total_tokens_bought_back = 0;
        
        config.bump = ctx.bumps.config;

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
        }

        if let Some(amount) = new_min_buyback_amount {
            require!(amount > 0, AsciiError::InvalidAmount);
            config.min_buyback_amount = amount;
        }

        if let Some(treasury) = new_treasury {
            config.treasury = treasury;
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

        // Buyback token mint is validated by account constraint in ExecuteBuyback struct
        // This reduces compute units by moving validation to constraints

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

        // Update statistics: increment buyback count and tokens bought back
        let config = &mut ctx.accounts.config;
        config.total_buybacks_executed = config.total_buybacks_executed
            .checked_add(1)
            .ok_or(AsciiError::InvalidAmount)?;
        config.total_tokens_bought_back = config.total_tokens_bought_back
            .checked_add(token_amount)
            .ok_or(AsciiError::InvalidAmount)?;

        emit!(BuybackEvent {
            amount_sol: amount,
            token_amount,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    pub fn mint_ascii_nft(
        ctx: Context<MintAsciiNft>,
        name: String,
        symbol: String,
        uri: String, // IPFS URI for metadata JSON
        ascii_length: u32, // Length of ASCII art for validation
    ) -> Result<()> {
        // Optimized validation: Combine all string validations upfront to fail fast
        // This reduces compute units by validating before any other operations
        // and avoids unnecessary string operations if validation fails
        
        // Validate ASCII art length
        require!(
            ascii_length >= MIN_ASCII_LENGTH && ascii_length <= MAX_ASCII_LENGTH,
            AsciiError::InvalidLength
        );

        // Combined string validation: Check all strings in one pass
        // Using early returns pattern to minimize compute units
        let name_len = name.len();
        let symbol_len = symbol.len();
        let uri_len = uri.len();
        
        require!(
            name_len > 0 && name_len <= MAX_NAME_LENGTH,
            AsciiError::InvalidName
        );
        
        require!(
            symbol_len > 0 && symbol_len <= MAX_SYMBOL_LENGTH,
            AsciiError::InvalidSymbol
        );
        
        require!(
            uri_len > 0 && uri_len <= MAX_URI_LENGTH,
            AsciiError::InvalidUri
        );

        // Read mint fee from config (immutable borrow)
        let mint_fee = ctx.accounts.config.mint_fee;
        
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

        // Update statistics: increment total mints and fees collected
        // Now we can get mutable reference to config since we're done with immutable operations
        let config = &mut ctx.accounts.config;
        config.total_mints = config.total_mints.checked_add(1).ok_or(AsciiError::InvalidAmount)?;
        config.total_fees_collected = config.total_fees_collected
            .checked_add(mint_fee)
            .ok_or(AsciiError::InvalidAmount)?;

        // The mint is created and initialized by client pre-instructions
        // Ownership is verified by the account constraint in MintAsciiNft struct
        // This approach reduces compute units by moving validation to constraints
        
        // The mint authority is the mint_authority PDA
        let bump = ctx.bumps.mint_authority;
        let mint_authority_seeds = &[
            b"mint_authority".as_ref(),
            &[bump],
        ];
        let signer = &[&mint_authority_seeds[..]];

        // Mint account ownership is validated by the account constraint
        // This avoids AccountInfo staleness issues and reduces compute units

        // Create Associated Token Account (ATA) for the payer if it doesn't exist
        // Must be done after mint is initialized
        // Check if account exists first - if not, create it
        // If it exists, verify it's owned by Token Program
        if ctx.accounts.token_account.data_is_empty() {
            // Account doesn't exist - create it
        anchor_spl::associated_token::create(
            CpiContext::new(
                ctx.accounts.associated_token_program.to_account_info(),
                anchor_spl::associated_token::Create {
                    payer: ctx.accounts.payer.to_account_info(),
                    associated_token: ctx.accounts.token_account.to_account_info(),
                    authority: ctx.accounts.payer.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                },
            ),
        )?;
        } else {
            // Account exists - verify it's owned by Token Program
            require!(
                ctx.accounts.token_account.owner == &anchor_spl::token::ID,
                AsciiError::InvalidMintAccount
            );
        }

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
        // Note: verified must be false when calling via CPI - creator can verify later
        // Setting verified: true requires the creator to sign, which isn't passed through CPI
        let creator = vec![mpl_token_metadata::types::Creator {
            address: ctx.accounts.payer.key(),
            verified: false, // Must be false for CPI calls
            share: 100,
        }];

        // Create DataV2 for Metaplex metadata
        // Note: Clones are necessary here because:
        // 1. DataV2 requires owned String values (not references)
        // 2. We also need the strings for the event emission
        // 3. Metaplex CPI requires owned values
        // This is a trade-off: clones cost compute units but are required for Metaplex compatibility
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

        // Verify the creator (payer) - this removes the "Unverified" warning
        // The payer is a signer in this transaction, so they can self-verify
        mpl_token_metadata::instructions::SignMetadataCpiBuilder::new(
            &ctx.accounts.token_metadata_program.to_account_info(),
        )
        .metadata(&ctx.accounts.metadata.to_account_info())
        .creator(&ctx.accounts.payer.to_account_info())
        .invoke()?;

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


