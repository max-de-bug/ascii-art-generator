# Anchor Program Setup Guide

This guide explains how to build, deploy, and use the Anchor program for NFT minting.

## Prerequisites

1. **Anchor CLI** - Install from [anchor-lang.com](https://www.anchor-lang.com/)

   ```bash
   avm install latest
   avm use latest
   ```

2. **Solana CLI** - Install from [solana.com](https://docs.solana.com/cli/install-solana-cli-tools)

3. **Rust** - Install from [rustup.rs](https://rustup.rs/)

## Building the Program

1. Navigate to the Anchor program directory:

   ```bash
   cd app/components/smartcontracts/ascii
   ```

2. Build the program:

   ```bash
   anchor build
   ```

   This will:

   - Compile the Rust program
   - Generate the IDL (Interface Definition Language)
   - Create the program binary

3. The IDL will be generated at:
   ```
   target/idl/ascii.json
   ```

## Deploying the Program

### Localnet (for testing)

1. Start a local validator:

   ```bash
   solana-test-validator
   ```

2. In a new terminal, deploy to localnet:

   ```bash
   cd app/components/smartcontracts/ascii
   anchor deploy
   ```

3. Note the program ID from the output. Update `Anchor.toml` if needed.

### Devnet (for testing on public network)

1. Set your Solana CLI to devnet:

   ```bash
   solana config set --url devnet
   ```

2. Airdrop SOL (if needed):

   ```bash
   solana airdrop 2
   ```

3. Deploy:

   ```bash
   anchor deploy --provider.cluster devnet
   ```

4. Update your `.env.local`:
   ```env
   NEXT_PUBLIC_ANCHOR_PROGRAM_ID=your_program_id_here
   ```

### Mainnet (production)

1. Set your Solana CLI to mainnet:

   ```bash
   solana config set --url mainnet-beta
   ```

2. Deploy (this costs real SOL):

   ```bash
   anchor deploy --provider.cluster mainnet-beta
   ```

3. Update your `.env.local`:
   ```env
   NEXT_PUBLIC_ANCHOR_PROGRAM_ID=your_program_id_here
   ```

## Program Features

The Anchor program provides:

1. **Custom Validation**

   - Validates ASCII art length (1-50,000 characters)
   - Prevents invalid mints

2. **State Tracking**

   - Tracks total NFTs minted
   - Records last mint timestamp
   - Stored in `MintState` account

3. **Metaplex Integration**
   - Uses CPI (Cross-Program Invocation) to call Metaplex
   - Creates standard NFT metadata
   - Compatible with all Solana wallets

## Program Accounts

### MintState

- **Purpose**: Tracks program statistics
- **PDA**: `["mint_state"]`
- **Data**:
  - `total_minted: u64` - Total number of NFTs minted
  - `last_mint: i64` - Unix timestamp of last mint

### Mint Authority

- **Purpose**: Controls all mints created by the program
- **PDA**: `["mint_authority"]`
- **Authority**: The program itself

## Testing

1. Run tests:

   ```bash
   anchor test
   ```

2. Or run with a specific cluster:
   ```bash
   anchor test --provider.cluster devnet
   ```

## Troubleshooting

### "IDL not found" error

- Make sure you've run `anchor build`
- Check that `target/idl/ascii.json` exists
- The IDL is needed for the TypeScript client

### "Program ID mismatch"

- Update `declare_id!()` in `lib.rs` to match your deployed program ID
- Update `Anchor.toml` with the correct program ID
- Update `.env.local` with `NEXT_PUBLIC_ANCHOR_PROGRAM_ID`

### Build errors

- Make sure all dependencies are installed:
  ```bash
  cargo build-sbf
  ```
- Check Rust version: `rustc --version` (should be 1.75+)
- Check Anchor version: `anchor --version` (should be 0.32.1)

### Deployment errors

- Ensure you have enough SOL for rent
- Check your wallet is configured: `solana address`
- Verify network: `solana config get`

## Program ID

The default program ID is: `56cKjpFg9QjDsRCPrHnj1efqZaw2cvfodNhz4ramoXxt`

After deployment, update:

1. `declare_id!()` in `lib.rs`
2. `Anchor.toml` programs section
3. `.env.local` `NEXT_PUBLIC_ANCHOR_PROGRAM_ID`

## Next Steps

1. Build the program: `anchor build`
2. Deploy to devnet: `anchor deploy --provider.cluster devnet`
3. Update environment variables
4. Test minting from your app

## Additional Features You Can Add

- **Fees**: Take a fee on each mint
- **Whitelist**: Only allow certain addresses to mint
- **Rate Limiting**: Limit mints per address
- **Collection**: Group NFTs into a collection
- **Royalties**: Set custom royalty percentages
- **On-chain Storage**: Store ASCII art on-chain (if small enough)
