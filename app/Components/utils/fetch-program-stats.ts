import { Connection, PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider, Idl } from "@coral-xyz/anchor";
import { Wallet } from "@coral-xyz/anchor";
import { deriveConfigPDA } from "./mint-nft-anchor";

/**
 * Program statistics from the on-chain config account
 */
export interface ProgramStats {
  totalMints: number;
  totalFeesCollected: number; // in lamports
  totalBuybacksExecuted: number;
  totalTokensBoughtBack: number;
  mintFee: number; // in lamports
  minBuybackAmount: number; // in lamports
  authority: string;
  treasury: string;
  buybackTokenMint: string;
}

/**
 * Fetch program statistics from the on-chain config account
 * This function reads the ProgramConfig account which contains all statistics
 * 
 * @param connection - Solana connection
 * @param programId - Anchor program ID
 * @returns Program statistics or null if config doesn't exist
 */
export async function fetchProgramStats(
  connection: Connection,
  programId: PublicKey
): Promise<ProgramStats | null> {
  try {
    // Load IDL
    let idl: Idl;
    try {
      if (typeof window === "undefined") {
        throw new Error("IDL loading must happen client-side");
      }
      // Try to import IDL - use absolute path with @ alias (same as mint-nft-anchor.ts)
      // This ensures webpack/Turbopack can resolve it at build time
      const idlModule = await import(
        "@/app/Components/smartcontracts/ascii/target/idl/ascii.json"
      ).catch(() => {
        // Fallback: try alternative path or return null
        return null;
      });
      
      if (!idlModule) {
        throw new Error("IDL module not found");
      }
      
      idl = (idlModule.default || idlModule) as Idl;
    } catch (error: any) {
      throw new Error(
        `IDL not found: ${error.message}. Please run 'anchor build' in the smartcontracts/ascii directory first.`
      );
    }

    // Create a read-only provider (no wallet needed for reading)
    // We use a dummy wallet since we're only reading data
    const dummyWallet = {
      publicKey: PublicKey.default,
      signTransaction: async (tx: any) => tx,
      signAllTransactions: async (txs: any[]) => txs,
    } as Wallet;

    const provider = new AnchorProvider(connection, dummyWallet, {
      commitment: "confirmed",
    });

    // Load the program
    const program = new Program(idl, provider);

    // Derive config PDA
    const [configPDA] = deriveConfigPDA(programId);

    // Fetch the config account
    // Note: Account name comes from the struct name in Rust (ProgramConfig -> programConfig)
    // If this doesn't work, check your IDL file for the exact account name
    const config = await (program.account as any).programConfig.fetch(configPDA);

    // Convert to our interface format
    return {
      totalMints: Number(config.totalMints),
      totalFeesCollected: Number(config.totalFeesCollected),
      totalBuybacksExecuted: Number(config.totalBuybacksExecuted),
      totalTokensBoughtBack: Number(config.totalTokensBoughtBack),
      mintFee: Number(config.mintFee),
      minBuybackAmount: Number(config.minBuybackAmount),
      authority: config.authority.toString(),
      treasury: config.treasury.toString(),
      buybackTokenMint: config.buybackTokenMint.toString(),
    };
  } catch (error: any) {
    // If account doesn't exist, return null
    if (error.message?.includes("Account does not exist") || 
        error.message?.includes("Invalid account data")) {
      return null;
    }
    console.error("Error fetching program stats:", error);
    throw error;
  }
}

/**
 * Format lamports to SOL
 */
export function formatLamportsToSol(lamports: number): string {
  return (lamports / 1_000_000_000).toFixed(4);
}

/**
 * Format large numbers with commas
 */
export function formatNumber(num: number): string {
  return num.toLocaleString("en-US");
}

