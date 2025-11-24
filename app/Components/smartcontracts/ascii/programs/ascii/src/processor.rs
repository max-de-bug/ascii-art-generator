use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::invoke,
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

// Import from parent module
use crate::*;

// Instruction handler functions (called from #[program] in lib.rs)
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
        config.min_buyback_amount = MIN_BUYBACK_AMOUNT;
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

    pub fn mint_ascii_nft(
        ctx: Context<MintAsciiNft>,
        name: String,
        symbol: String,
        uri: String, // IPFS URI for metadata JSON
        ascii_length: u32, // Length of ASCII art for validation
    ) -> Result<()> {
        // Custom validation: Check ASCII art length
        require!(
            ascii_length >= MIN_ASCII_LENGTH && ascii_length <= MAX_ASCII_LENGTH,
            AsciiError::InvalidLength
        );

        // Validate name length (Metaplex standard: max 32 chars)
        require!(
            !name.is_empty() && name.len() <= MAX_NAME_LENGTH,
            AsciiError::InvalidName
        );

        // Validate symbol length (Metaplex standard: max 10 chars)
        require!(
            !symbol.is_empty() && symbol.len() <= MAX_SYMBOL_LENGTH,
            AsciiError::InvalidSymbol
        );

        // Validate URI length (reasonable limit: 200 chars)
        require!(
            !uri.is_empty() && uri.len() <= MAX_URI_LENGTH,
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

        // Handle mint account creation and initialization
        // Best practice: Manually handle all account states to avoid constraint conflicts
        // The mint keypair is provided as a signer by the client
        let mint_account_info = ctx.accounts.mint.to_account_info();
        let mint_owner = mint_account_info.owner;
        let mint_lamports = mint_account_info.lamports();
        
        // The mint authority is the mint_authority PDA
        let bump = ctx.bumps.mint_authority;
        let mint_authority_seeds = &[
            b"mint_authority".as_ref(),
            &[bump],
        ];
        let signer = &[&mint_authority_seeds[..]];

        // Note: mint is already verified as a signer by the Signer<'info> constraint
        // Signer constraint only validates is_signer, not ownership, so it works even if account is initialized
        // Check account state and handle accordingly
        if mint_lamports == 0 {
            // Account doesn't exist - create it first, then initialize
            msg!("Mint account doesn't exist, creating...");
            let rent = anchor_lang::solana_program::sysvar::rent::Rent::get()?;
            let mint_rent = rent.minimum_balance(82); // Mint account size
            
            // Create the account as uninitialized (owned by System Program)
            // It will be assigned to Token program by initialize_mint
            // Use invoke_signed with the mint keypair as signer
            anchor_lang::solana_program::program::invoke_signed(
                &anchor_lang::solana_program::system_instruction::create_account(
                    ctx.accounts.payer.key,
                    mint_account_info.key,
                    mint_rent,
                    82,
                    &system_program::ID, // Create as uninitialized, will be assigned to Token program by initialize_mint
                ),
                &[
                    ctx.accounts.payer.to_account_info(),
                    mint_account_info.clone(),
                    ctx.accounts.system_program.to_account_info(),
                ],
                &[], // No additional signers needed - mint is already a signer
            )?;
            
            // Now initialize it
            initialize_mint(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    InitializeMint {
                        mint: mint_account_info,
                        rent: ctx.accounts.rent.to_account_info(),
                    },
                    signer,
                ),
                0, // decimals (NFTs have 0 decimals)
                &ctx.accounts.mint_authority.key(),
                None, // freeze_authority (None for NFTs)
            )?;
            msg!("Mint account created and initialized");
        } else if mint_owner == &system_program::ID {
            // Account exists but is uninitialized (owned by System Program)
            msg!("Mint account exists but is uninitialized, initializing...");
            initialize_mint(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    InitializeMint {
                        mint: mint_account_info,
                        rent: ctx.accounts.rent.to_account_info(),
                    },
                    signer,
                ),
                0, // decimals (NFTs have 0 decimals)
                &ctx.accounts.mint_authority.key(),
                None, // freeze_authority (None for NFTs)
            )?;
            msg!("Mint account initialized");
        } else if mint_owner == &anchor_spl::token::ID {
            // Account is already initialized (owned by Token Program)
            // This can happen if a previous transaction succeeded but this one is retrying
            // Verify the mint is valid and proceed
            msg!("Mint account already initialized, verifying and proceeding...");
            // Note: We could add additional validation here if needed
            // For now, we'll proceed with minting
        } else {
            // Account exists but is owned by an unexpected program
            return Err(AsciiError::InvalidMintAccount.into());
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