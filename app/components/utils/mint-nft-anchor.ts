import {
  Connection,
  PublicKey,
  Transaction,
  VersionedTransaction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { Program, AnchorProvider, Wallet, BN, Idl } from "@coral-xyz/anchor";
// Import Bundlr storage functions (Arweave via SOL payment)
import { uploadImageToBundlr, uploadMetadataToBundlr } from "./storage-bundlr";

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
  bundlrPrivateKey?: string; // Optional: Bundlr private key for uploads
  bundlrNetwork?: "mainnet" | "devnet"; // Optional: Bundlr network
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
 * Derive the mint state PDA
 */
function deriveMintStatePDA(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("mint_state")],
    programId
  );
}

/**
 * Derive the user state PDA for a specific user
 * PDA seeds: ["user_state", user_public_key]
 */
function deriveUserStatePDA(
  programId: PublicKey,
  user: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("user_state"), user.toBuffer()],
    programId
  );
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
  bundlrPrivateKey,
  bundlrNetwork,
}: MintNFTParams): Promise<{
  mint: PublicKey;
  signature: string;
}> {
  // 1. Upload image to Arweave via Bundlr (permanent storage, pay with SOL)
  // Bundlr makes it easy to upload to Arweave using SOL instead of AR tokens
  const imageUri = await uploadImageToBundlr(
    imageBlob,
    bundlrNetwork,
    bundlrPrivateKey
  );

  // 2. Create metadata
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

  // 3. Upload metadata to Arweave via Bundlr (permanent storage, pay with SOL)
  const metadataUri = await uploadMetadataToBundlr(
    metadata,
    bundlrNetwork,
    bundlrPrivateKey
  );

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
    idl = idlModule.default || idlModule;
  } catch (error) {
    throw new Error(
      "IDL not found. Please run 'anchor build' in the smartcontracts/ascii directory first."
    );
  }

  // 7. Load the program
  const program = new Program(idl, provider);

  // 8. Derive PDAs
  const [mintAuthority] = deriveMintAuthorityPDA(program.programId);
  const [mintState] = deriveMintStatePDA(program.programId);
  const [userState] = deriveUserStatePDA(program.programId, wallet);

  // 9. Generate a new mint keypair (we'll use a random keypair for uniqueness)
  const { Keypair } = await import("@solana/web3.js");
  const mintKeypair = Keypair.generate();
  const mint = mintKeypair.publicKey; // This becomes the unique NFT identifier

  // 10. Get associated token account
  const associatedTokenAccount = await getAssociatedTokenAddress(mint, wallet);

  // 11. Derive metadata PDA
  const [metadataPDA] = deriveMetadataPDA(mint);

  // 12. Build and send the transaction
  // Note: .rpc() already sends and confirms the transaction based on the provider's commitment level
  const tx = await program.methods
    .mintAsciiNft(name, "ASCII", metadataUri, new BN(asciiArt.length))
    .accounts({
      payer: wallet,
      tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
      mintAuthority: mintAuthority,
      mint: mint,
      tokenAccount: associatedTokenAccount,
      metadata: metadataPDA,
      mintState: mintState,
      userState: userState,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    })
    .signers([mintKeypair])
    .rpc();

  // 13. Additional confirmation using modern API (optional, .rpc() already confirms)
  const latestBlockhash = await connection.getLatestBlockhash("confirmed");
  await connection.confirmTransaction(
    {
      signature: tx,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    },
    "confirmed"
  );

  return {
    mint,
    signature: tx,
  };
}
