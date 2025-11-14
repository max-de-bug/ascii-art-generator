/**
 * Bundlr storage provider (Arweave gateway)
 *
 * Bundlr makes it easy to upload to Arweave using SOL, ETH, or other tokens
 * No need to buy AR tokens directly!
 *
 * Setup:
 * 1. Install: npm install @bundlr-network/client
 * 2. Fund your Bundlr account with SOL (or ETH)
 * 3. Add BUNDLR_PRIVATE_KEY to .env.local (or use wallet adapter)
 *
 * Benefits:
 * - Pay with SOL (no need to buy AR tokens)
 * - Permanent storage (Arweave)
 * - Easy integration with Solana wallets
 * 
 * NOTE: This module is client-only to avoid Node.js module imports in browser
 */

"use client";

// Use dynamic import to avoid bundling Node.js dependencies at build time
// This ensures Turbopack doesn't try to analyze avsc, arbundles, etc. during build
import { Keypair } from "@solana/web3.js";

// Bundlr network endpoints
const BUNDLR_NETWORKS = {
  mainnet: "https://node1.bundlr.network",
  devnet: "https://devnet.bundlr.network",
} as const;

/**
 * Initialize Bundlr client (with dynamic import)
 */
async function getBundlrClient(
  network: "mainnet" | "devnet" = "mainnet",
  privateKey?: string
) {
  // Dynamic import - only loads when function is called, not at module load time
  // Turbopack's resolveAlias config handles Node.js module exclusions
  const Bundlr = (await import("@bundlr-network/client")).default;
  const endpoint = BUNDLR_NETWORKS[network];

  if (!privateKey) {
    throw new Error(
      "Bundlr private key required. Set BUNDLR_PRIVATE_KEY in .env.local or pass as parameter."
    );
  }

  // Convert private key string to Uint8Array
  const keypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(privateKey)));

  return new Bundlr(endpoint, "solana", keypair.secretKey);
}

/**
 * Upload image to Arweave via Bundlr
 *
 * @param imageBlob - The image blob to upload
 * @param network - Network to use (mainnet/devnet)
 * @param privateKey - Private key for Bundlr (or use env var)
 * @returns Arweave transaction ID (permanent URL)
 */
export async function uploadImageToBundlr(
  imageBlob: Blob,
  network?: "mainnet" | "devnet",
  privateKey?: string
): Promise<string> {
  // Runtime check - ensure this only runs in the browser
  if (typeof window === "undefined") {
    throw new Error("uploadImageToBundlr can only be called in the browser");
  }
  
  try {
    const key = privateKey || process.env.BUNDLR_PRIVATE_KEY;
    
    // Use network from parameter, or fall back to env file, or default to mainnet
    const bundlrNetwork: "mainnet" | "devnet" = 
      network || 
      (process.env.NEXT_PUBLIC_BUNDLR_NETWORK as "mainnet" | "devnet") || 
      "mainnet";
    const bundlr = await getBundlrClient(bundlrNetwork, key);

    // Convert blob to buffer
    const arrayBuffer = await imageBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Get price estimate
    const price = await bundlr.getPrice(buffer.length);
    const balance = await bundlr.getLoadedBalance();

    if (balance.isLessThan(price)) {
      throw new Error(
        `Insufficient Bundlr balance. Need ${price.toString()} SOL, have ${balance.toString()} SOL`
      );
    }

    // Upload with tags
    const tags = [
      { name: "Content-Type", value: "image/png" },
      { name: "App-Name", value: "ASCII-Art-Generator" },
      { name: "Type", value: "NFT-Image" },
    ];

    const response = await bundlr.upload(buffer, {
      tags,
    });

    return `https://arweave.net/${response.id}`;
  } catch (error) {
    console.error("Error uploading to Bundlr:", error);
    throw error;
  }
}

/**
 * Upload metadata JSON to Arweave via Bundlr
 */
export async function uploadMetadataToBundlr(
  metadata: {
    name: string;
    description: string;
    image: string;
    attributes?: Array<{ trait_type: string; value: string }>;
  },
  network?: "mainnet" | "devnet",
  privateKey?: string
): Promise<string> {
  try {
    const key = privateKey || process.env.BUNDLR_PRIVATE_KEY;
    
    // Use network from parameter, or fall back to env file, or default to mainnet
    const bundlrNetwork: "mainnet" | "devnet" = 
      network || 
      (process.env.NEXT_PUBLIC_BUNDLR_NETWORK as "mainnet" | "devnet") || 
      "mainnet";
    const bundlr = await getBundlrClient(bundlrNetwork, key);

    const metadataBuffer = Buffer.from(JSON.stringify(metadata));

    const price = await bundlr.getPrice(metadataBuffer.length);
    const balance = await bundlr.getLoadedBalance();

    if (balance.isLessThan(price)) {
      throw new Error(
        `Insufficient Bundlr balance. Need ${price.toString()} SOL, have ${balance.toString()} SOL`
      );
    }

    const tags = [
      { name: "Content-Type", value: "application/json" },
      { name: "App-Name", value: "ASCII-Art-Generator" },
      { name: "Type", value: "NFT-Metadata" },
    ];

    const response = await bundlr.upload(metadataBuffer, {
      tags,
    });

    return `https://arweave.net/${response.id}`;
  } catch (error) {
    console.error("Error uploading metadata to Bundlr:", error);
    throw error;
  }
}
