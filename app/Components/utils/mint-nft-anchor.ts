import {
  Connection,
  PublicKey,
  Transaction,
  VersionedTransaction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  LAMPORTS_PER_SOL,
  Keypair,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createInitializeMintInstruction,
  MINT_SIZE,
} from "@solana/spl-token";
import { Program, AnchorProvider, Wallet, BN, Idl } from "@coral-xyz/anchor";
// Import Lighthouse IPFS storage functions
// Use dynamic import to ensure client-only loading
const loadNFTStorage = () => import("./storage-nft");

// IDL will be generated after building the Anchor program
// For now, we'll define it inline or load it dynamically
// After running `anchor build`, the IDL will be in target/idl/ascii.json

// Metaplex Token Metadata Program ID
const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

/**
 * Creates an Anchor-compatible Wallet from wallet adapter hooks
 *
 * ✅ BEST PRACTICE: Extract to reusable utility function
 *
 * This adapter bridges the interface gap between:
 * - @solana/wallet-adapter-react (useWallet hook)
 * - @coral-xyz/anchor (AnchorProvider)
 *
 * Why this is best practice:
 * 1. ✅ Reusable across multiple functions/components
 * 2. ✅ Type-safe with proper error handling
 * 3. ✅ Handles optional signAllTransactions gracefully
 * 4. ✅ Follows DRY (Don't Repeat Yourself) principle
 * 5. ✅ Standard pattern in Solana/Anchor development
 *
 * @param publicKey - The wallet's public key
 * @param signTransaction - Function to sign a single transaction
 * @param signAllTransactions - Optional function to sign multiple transactions
 * @returns Anchor-compatible Wallet object
 */
function createAnchorWallet(
  publicKey: PublicKey,
  signTransaction: (tx: Transaction) => Promise<Transaction>,
  signAllTransactions?: (txs: Transaction[]) => Promise<Transaction[]>
): Wallet {
  // Type assertion needed because Anchor's Wallet interface accepts
  // Transaction | VersionedTransaction, but wallet adapter provides Transaction
  const wallet: Wallet = {
    publicKey,
    signTransaction: signTransaction as <
      T extends Transaction | VersionedTransaction
    >(
      tx: T
    ) => Promise<T>,
    // Use provided signAllTransactions if available, otherwise implement it
    // This is more efficient than always mapping over transactions
    signAllTransactions: signAllTransactions
      ? (signAllTransactions as <T extends Transaction | VersionedTransaction>(
          txs: T[]
        ) => Promise<T[]>)
      : async <T extends Transaction | VersionedTransaction>(txs: T[]) => {
          return Promise.all(
            txs.map((tx) => signTransaction(tx as Transaction) as Promise<T>)
          );
        },
  } as Wallet;

  return wallet;
}

interface MintNFTParams {
  connection: Connection;
  wallet: PublicKey;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
  asciiArt: string;
  imageBlob: Blob;
  programId: PublicKey;
  name?: string;
  description?: string;
}

/**
 * Derive the metadata PDA for a mint
 */
function deriveMetadataPDA(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );
}

/**
 * Derive the mint authority PDA
 */
function deriveMintAuthorityPDA(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("mint_authority")],
    programId
  );
}

/**
 * Derive the fee vault PDA
 * PDA seeds: ["fee_vault"]
 */
function deriveFeeVaultPDA(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("fee_vault")],
    programId
  );
}

/**
 * Derive the config PDA
 * PDA seeds: ["config"]
 */
export function deriveConfigPDA(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    programId
  );
}

/**
 * Initialize the program config account
 * This must be called once before minting NFTs
 * 
 * @param connection - Solana connection
 * @param wallet - Wallet public key
 * @param signTransaction - Transaction signing function
 * @param treasury - Treasury address where buyback tokens go (defaults to wallet)
 * @returns Transaction signature
 */
export async function initializeProgramConfig({
  connection,
  wallet,
  signTransaction,
  treasury,
}: {
  connection: Connection;
  wallet: PublicKey;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
  treasury?: PublicKey; // Optional, defaults to wallet
}): Promise<string> {
  // Create Anchor-compatible wallet
  const anchorWallet = createAnchorWallet(wallet, signTransaction);

  // Create Anchor provider
  const provider = new AnchorProvider(connection, anchorWallet, {
    commitment: "confirmed",
  });

  // Load IDL
  let idl: Idl;
  try {
    if (typeof window === "undefined") {
      throw new Error("IDL loading must happen client-side");
    }
    const idlModule = await import(
      "../smartcontracts/ascii/target/idl/ascii.json"
    );
    idl = (idlModule.default || idlModule) as Idl;
  } catch (error) {
    throw new Error(
      "IDL not found. Please run 'anchor build' in the smartcontracts/ascii directory first."
    );
  }

  // Load the program - this uses the program ID from the IDL (source of truth)
  const program = new Program(idl, provider);
  
  // Use IDL's program ID (this is the source of truth)
  const programId = program.programId;
  const treasuryAddress = treasury || wallet; // Default to wallet if not provided

  // Derive PDAs using IDL's program ID
  const [configPDA] = deriveConfigPDA(programId);
  const [feeVault] = deriveFeeVaultPDA(programId);

  // Check if config already exists
  const configAccountInfo = await connection.getAccountInfo(configPDA);
  if (configAccountInfo) {
    throw new Error(
      `Program config already initialized at ${configPDA.toString()}`
    );
  }

  // Initialize config
  // Add compute budget instructions for better reliability
  const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
    units: 200_000, // Config initialization is simpler, needs less compute units
  });
  
  const priorityFeeIx = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: 1_000, // 0.001 SOL per compute unit
  });
  
  const signature = await program.methods
    .initializeConfig(treasuryAddress)
    .accounts({
      config: configPDA,
      authority: wallet,
      feeVault: feeVault,
      systemProgram: SystemProgram.programId,
    })
    .preInstructions([computeBudgetIx, priorityFeeIx])
    .rpc();

  console.log(`✓ Config initialized with Program ID: ${programId.toString()}`);
  console.log(`✓ Config PDA: ${configPDA.toString()}`);
  console.log(`✓ Treasury: ${treasuryAddress.toString()}`);
  console.log(`✓ Transaction: ${signature}`);

  return signature;
}

/**
 * Mint an NFT using the Anchor program
 */
export async function mintAsciiArtNFTAnchor({
  connection,
  wallet,
  signTransaction,
  asciiArt,
  imageBlob,
  programId,
  name = "ASCII Art",
  description = "Generated ASCII art",
}: MintNFTParams): Promise<{
  mint: PublicKey;
  signature: string;
}> {
  // 1. Upload image and metadata to IPFS via Lighthouse
  // Lighthouse provides decentralized IPFS storage
  // Use dynamic import to ensure client-only loading (avoids Node.js module issues)
  const { uploadImageToNFTStorage, uploadMetadataToNFTStorage } = await loadNFTStorage();
  
  // Upload image first to get IPFS URL
  const imageUri = await uploadImageToNFTStorage(imageBlob);

  // Create metadata with image IPFS URL
  const metadata = {
    name: name,
    description: `${description}\n\nASCII Art:\n${asciiArt}`,
    image: imageUri,
    attributes: [
      {
        trait_type: "Type",
        value: "ASCII Art",
      },
      {
        trait_type: "Length",
        value: asciiArt.length.toString(),
      },
    ],
  };

  // Upload metadata to IPFS
  const metadataUri = await uploadMetadataToNFTStorage(metadata);

  // 4. Create Anchor-compatible wallet adapter
  // ✅ BEST PRACTICE: Use reusable utility function (see createAnchorWallet above)
  // This pattern is standard in Solana/Anchor development and provides:
  // - Type safety
  // - Reusability across the codebase
  // - Proper handling of optional signAllTransactions
  const anchorWallet = createAnchorWallet(wallet, signTransaction);

  // 5. Create Anchor provider
  // The provider connects Anchor to:
  // - The Solana network (via connection)
  // - The user's wallet (via anchorWallet)
  // - Transaction confirmation settings (via commitment level)
  const provider = new AnchorProvider(connection, anchorWallet, {
    commitment: "confirmed",
  });

  // 6. Load the program IDL
  // The IDL should be generated after running `anchor build`
  // Dynamically import to avoid SSR issues
  let idl: Idl;
  try {
    // Use dynamic import with explicit client-side check
    if (typeof window === "undefined") {
      throw new Error("IDL loading must happen client-side");
    }
    // Try to load the IDL from the generated file
    const idlModule = await import(
      "../smartcontracts/ascii/target/idl/ascii.json"
    );
    // Type assertion needed: JSON imports infer string types for literals like "const"
    // but Anchor's Idl type expects literal types. This is safe because the IDL
    // is generated by Anchor and matches the expected structure.
    idl = (idlModule.default || idlModule) as Idl;
  } catch (error) {
    throw new Error(
      "IDL not found. Please run 'anchor build' in the smartcontracts/ascii directory first."
    );
  }

  // 7. Load the program
  const program = new Program(idl, provider);

  // 8. Derive PDAs
  const [mintAuthority] = deriveMintAuthorityPDA(program.programId);
  const [feeVault] = deriveFeeVaultPDA(program.programId);
  const [configPDA] = deriveConfigPDA(program.programId);

  // 8.5. Check if config account exists
  // Note: The config must be initialized by the program deployer/owner before users can mint
  // This is a one-time setup that should be done after program deployment
  let configAccountInfo = await connection.getAccountInfo(configPDA, "finalized");
  if (!configAccountInfo) {
    configAccountInfo = await connection.getAccountInfo(configPDA, "confirmed");
  }
  
  if (!configAccountInfo) {
    const programIdStr = program.programId.toString();
    const network = connection.rpcEndpoint.includes("devnet") ? "devnet" : 
                   connection.rpcEndpoint.includes("mainnet") ? "mainnet" : "unknown";
    
    throw new Error(
      `Program config not initialized.\n\n` +
      `The program config must be initialized by the program deployer before users can mint NFTs.\n\n` +
      `Program ID: ${programIdStr}\n` +
      `Network: ${network}\n` +
      `Config PDA: ${configPDA.toString()}\n\n` +
      `To initialize, the program owner should run:\n` +
      `await initializeProgramConfig({\n` +
      `  connection,\n` +
      `  wallet: deployerWallet,\n` +
      `  signTransaction,\n` +
      `  treasury: treasuryAddress, // Your treasury address\n` +
      `});\n\n` +
      `Note: This is a one-time setup. After initialization, all users can mint without any setup.`
    );
  }
  
  console.log(`✓ Config account found at ${configPDA.toString()}`);

  // 9. Generate a new mint keypair (we'll use a random keypair for uniqueness)
  const mintKeypair = Keypair.generate();
  const mint = mintKeypair.publicKey; // This becomes the unique NFT identifier

  // 10. Check wallet balance before proceeding
  const walletBalance = await connection.getBalance(wallet);
  const minRequiredBalance = 0.1 * LAMPORTS_PER_SOL; // ~0.1 SOL for fees and rent
  
  if (walletBalance < minRequiredBalance) {
    const balanceSOL = walletBalance / LAMPORTS_PER_SOL;
    const requiredSOL = minRequiredBalance / LAMPORTS_PER_SOL;
    throw new Error(
      `Insufficient SOL balance. You have ${balanceSOL.toFixed(4)} SOL, but need at least ${requiredSOL.toFixed(4)} SOL for transaction fees and rent.`
    );
  }

  // 11. Get associated token account
  const associatedTokenAccount = await getAssociatedTokenAddress(mint, wallet);

  // 12. Derive metadata PDA
  const [metadataPDA] = deriveMetadataPDA(mint);

  // 13. Create pre-instructions to create and initialize the mint account
  // This is done client-side to avoid Solana's AccountInfo staleness issues
  // when doing create+initialize in the same program CPI
  const rentExemptBalance = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
  
  // Instruction 1: Create the mint account (owned by Token Program)
  const createMintAccountIx = SystemProgram.createAccount({
    fromPubkey: wallet,
    newAccountPubkey: mint,
    space: MINT_SIZE,
    lamports: rentExemptBalance,
    programId: TOKEN_PROGRAM_ID,
  });

  // Instruction 2: Initialize the mint (mint authority = PDA from program)
  const initializeMintIx = createInitializeMintInstruction(
    mint,           // mint account
    0,              // decimals (0 for NFTs)
    mintAuthority,  // mint authority (program's PDA)
    null,           // freeze authority (none for NFTs)
    TOKEN_PROGRAM_ID
  );

  // 14. Build and send the transaction with pre-instructions
  // The mint is created and initialized by the client, then the program:
  //   - Verifies mint is owned by Token Program
  //   - Creates ATA for the user
  //   - Mints 1 token (NFT)
  //   - Creates metadata via Metaplex
  
  // Compute Budget Instructions (Best Practice)
  // Set compute unit limit to prevent transaction failures
  // NFT minting with metadata creation typically needs 200k-300k compute units
  const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
    units: 300_000, // Safe limit for NFT minting with metadata
  });
  
  // Set priority fee to ensure transaction is processed quickly
  // Priority fee: 0.001 SOL (1,000,000 microlamports)
  const priorityFeeIx = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: 1_000, // 0.001 SOL per compute unit (adjust based on network conditions)
  });
  
  const signature = await program.methods
    .mintAsciiNft(name, "ASCII", metadataUri, new BN(asciiArt.length))
    .accounts({
      config: configPDA,
      payer: wallet,
      tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
      mintAuthority: mintAuthority,
      mint: mint,
      tokenAccount: associatedTokenAccount,
      metadata: metadataPDA,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      feeVault: feeVault,
    })
    .preInstructions([
      computeBudgetIx,      // Set compute unit limit (must be first)
      priorityFeeIx,         // Set priority fee
      createMintAccountIx,   // Create mint account
      initializeMintIx,      // Initialize mint
    ])
    .signers([mintKeypair]) // Mint keypair required for createAccount
    .rpc();

  // 14. Additional confirmation using modern API (optional, .rpc() already confirms)
  const latestBlockhash = await connection.getLatestBlockhash("confirmed");
  await connection.confirmTransaction(
    {
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    },
    "confirmed"
  );

  return {
    mint,
    signature,
  };
}
