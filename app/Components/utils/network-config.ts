import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { PublicKey } from "@solana/web3.js";

/**
 * Network-specific configuration for the Anchor program
 * 
 * IMPORTANT: When you deploy your program to different networks,
 * you'll get different program IDs. Update these values after deployment.
 */

// Default program ID (from lib.rs declare_id!)
// IMPORTANT: This must match the program ID in the IDL file
// Current IDL program ID: DvGwWxoj4k1BQfRoEL18CNYnZ8XYZp1xYHSgBZdvaCKT
const DEFAULT_PROGRAM_ID = "DvGwWxoj4k1BQfRoEL18CNYnZ8XYZp1xYHSgBZdvaCKT";

// Network-specific program IDs
// These should be set in environment variables or updated after deployment
const PROGRAM_IDS: Record<string, string> = {
  mainnet: process.env.NEXT_PUBLIC_ANCHOR_PROGRAM_ID_MAINNET || DEFAULT_PROGRAM_ID,
  devnet: process.env.NEXT_PUBLIC_ANCHOR_PROGRAM_ID_DEVNET || DEFAULT_PROGRAM_ID,
};

// Buyback token mint addresses (network-specific)
// Mainnet: AKzAhPPLMH5NG35kGbgkwtrTLeGyVrfCtApjnvqAATcm
// Devnet: You'll need to deploy/create a test token on devnet
const BUYBACK_TOKEN_MINTS: Record<string, string> = {
  mainnet: "AKzAhPPLMH5NG35kGbgkwtrTLeGyVrfCtApjnvqAATcm",
  devnet: process.env.NEXT_PUBLIC_BUYBACK_TOKEN_DEVNET || "AKzAhPPLMH5NG35kGbgkwtrTLeGyVrfCtApjnvqAATcm", // Update with devnet token
};

// Jupiter Swap Program ID (same for both networks)
const JUPITER_PROGRAM_ID = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";

// WSOL mint (same for both networks)
const WSOL_MINT = "So11111111111111111111111111111111111111112";

/**
 * Get the Anchor program ID for the current network
 */
export function getProgramId(network: WalletAdapterNetwork): PublicKey {
  const networkKey = network === WalletAdapterNetwork.Mainnet ? "mainnet" : "devnet";
  const programIdString = PROGRAM_IDS[networkKey];
  
  try {
    return new PublicKey(programIdString);
  } catch (error) {
    console.error(`Invalid program ID for ${networkKey}:`, programIdString);
    // Fallback to default
    return new PublicKey(DEFAULT_PROGRAM_ID);
  }
}

/**
 * Get the buyback token mint address for the current network
 */
export function getBuybackTokenMint(network: WalletAdapterNetwork): PublicKey {
  const networkKey = network === WalletAdapterNetwork.Mainnet ? "mainnet" : "devnet";
  const mintString = BUYBACK_TOKEN_MINTS[networkKey];
  
  try {
    return new PublicKey(mintString);
  } catch (error) {
    console.error(`Invalid buyback token mint for ${networkKey}:`, mintString);
    throw new Error(`Buyback token mint not configured for ${networkKey}`);
  }
}

/**
 * Get Jupiter program ID (same for all networks)
 */
export function getJupiterProgramId(): PublicKey {
  return new PublicKey(JUPITER_PROGRAM_ID);
}

/**
 * Get WSOL mint address (same for all networks)
 */
export function getWSOLMint(): PublicKey {
  return new PublicKey(WSOL_MINT);
}

/**
 * Get Solscan explorer URL for a transaction signature
 */
export function getSolscanUrl(signature: string, network: WalletAdapterNetwork): string {
  const networkSubdomain = network === WalletAdapterNetwork.Mainnet ? "" : "devnet.";
  return `https://${networkSubdomain}solscan.io/tx/${signature}`;
}

