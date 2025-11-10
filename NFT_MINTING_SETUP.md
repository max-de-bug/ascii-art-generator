# NFT Minting Setup Guide

This guide explains how to set up NFT minting for ASCII art on Solana.

## Overview

The implementation uses:

- **Metaplex Token Metadata Standard** - The standard way to create NFTs on Solana
- **IPFS Storage** - For storing images and metadata (using NFT.Storage)
- **Solana SPL Token** - For creating the NFT token
- **Wallet Adapter** - For wallet integration

## Setup Steps

### 1. Install Dependencies

```bash
npm install
```

This will install:

- `@metaplex-foundation/mpl-token-metadata` - Metaplex token metadata program
- `@solana/spl-token` - Solana SPL token library

### 2. Set Up NFT.Storage (IPFS)

1. Go to [NFT.Storage](https://nft.storage/) and sign up (free)
2. Create an API key
3. Add it to your `.env.local` file:

```env
NEXT_PUBLIC_NFT_STORAGE_KEY=your_api_key_here
```

**Alternative Storage Options:**

- **Arweave via Bundlr**: More permanent storage
- **Pinata**: Another IPFS pinning service
- **Your own server**: Host images and metadata yourself

To use a different storage, update the functions in `app/components/utils/nft-storage.ts`.

### 3. Configure Network

By default, the app uses **Mainnet**. To use a different network, update `app/components/Providers/wallet-provider.tsx`:

```typescript
// For devnet (recommended for testing)
const network = WalletAdapterNetwork.Devnet;

// For mainnet (production)
const network = WalletAdapterNetwork.Mainnet;
```

### 4. Test the Minting

1. Generate some ASCII art
2. Connect your wallet (Phantom, Solflare, etc.)
3. Click "Mint the art"
4. Approve the transaction in your wallet
5. Wait for confirmation

The NFT will appear in your wallet after the transaction is confirmed!

## How It Works

### Minting Process

1. **Create Image**: Converts ASCII art to a PNG image
2. **Upload Image**: Uploads image to IPFS via NFT.Storage
3. **Create Metadata**: Creates JSON metadata with:
   - Name: "ASCII Art"
   - Description: Includes the ASCII art text
   - Image: IPFS URL
   - Attributes: Type, Length
4. **Upload Metadata**: Uploads metadata JSON to IPFS
5. **Create NFT**:
   - Creates a new mint account
   - Mints 1 token (NFTs have 0 decimals)
   - Creates metadata account with Metaplex
   - Transfers NFT to your wallet

### Files Structure

```
app/components/
├── utils/
│   ├── mint-nft.ts          # Main minting function
│   └── nft-storage.ts       # IPFS upload utilities
├── MintButton.tsx           # UI component for minting
└── AsciiActions.tsx         # Exports createImageBlob function
```

## Customization

### Change NFT Name/Description

Edit `app/components/MintButton.tsx`:

```typescript
const { mint, signature } = await mintAsciiArtNFT({
  // ...
  name: "My Custom ASCII Art",
  description: "Custom description here",
});
```

### Change Image Background Color

The image is created with a black background by default. To change it:

```typescript
const imageBlob = await createImageBlob(asciiOutput, zoom, "#ffffff"); // White background
```

### Add More Attributes

Edit `app/components/utils/mint-nft.ts`:

```typescript
attributes: [
  { trait_type: "Type", value: "ASCII Art" },
  { trait_type: "Length", value: asciiArt.length.toString() },
  { trait_type: "Custom", value: "Your value" }, // Add more
],
```

## Troubleshooting

### "NFT.Storage API key not found"

- Make sure you've set `NEXT_PUBLIC_NFT_STORAGE_KEY` in `.env.local`
- Restart your dev server after adding the env variable

### "Insufficient funds"

- You need SOL in your wallet to pay for:
  - Transaction fees (~0.000005 SOL)
  - Rent for mint account (~0.00144 SOL)
  - Rent for metadata account (~0.00144 SOL)
- Total: ~0.003 SOL per mint

### "Transaction failed"

- Check the browser console for detailed error messages
- Make sure you're on the correct network (devnet/mainnet)
- Ensure your wallet has enough SOL

### NFT doesn't appear in wallet

- Wait a few seconds for the transaction to fully confirm
- Check the transaction on [Solscan](https://solscan.io/)
- Some wallets may need a refresh

## Cost Estimation

- **Transaction fee**: ~0.000005 SOL
- **Mint account rent**: ~0.00144 SOL (reclaimable)
- **Metadata account rent**: ~0.00144 SOL (reclaimable)
- **Total per mint**: ~0.003 SOL (~$0.30-0.50 depending on SOL price)

## Next Steps

- Add collection support (group NFTs together)
- Add royalties (earn from secondary sales)
- Add verification (verify creator on Metaplex)
- Add custom attributes based on ASCII art characteristics
- Store ASCII art on-chain (if small enough) or in metadata

## Resources

- [Metaplex Documentation](https://docs.metaplex.com/)
- [Solana Cookbook - NFTs](https://solanacookbook.com/references/nfts.html)
- [NFT.Storage Documentation](https://nft.storage/docs/)
- [Solana Web3.js Documentation](https://solana-labs.github.io/solana-web3.js/)
