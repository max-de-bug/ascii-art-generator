/**
 * NFT.Storage provider (IPFS gateway)
 *
 * NFT.Storage makes it easy to upload to IPFS for free
 * No need to pay for storage or manage wallets!
 *
 * Setup:
 * 1. Install: npm install nft.storage
 * 2. Get API key from https://nft.storage/
 * 3. Add NEXT_PUBLIC_NFT_STORAGE_KEY to .env.local
 *
 * Benefits:
 * - Free storage (up to 31GB)
 * - Easy setup (just API key)
 * - No wallet funding needed
 * - Widely used in NFT ecosystem
 * 
 * NOTE: This module is client-only to avoid Node.js module imports in browser
 */

"use client";

// Use dynamic import to avoid bundling Node.js dependencies at build time
import { NFTStorage, File } from "nft.storage";

/**
 * Initialize NFT.Storage client
 */
function getNFTStorageClient(): NFTStorage {
  const key = process.env.NEXT_PUBLIC_NFT_STORAGE_KEY;

  if (!key) {
    throw new Error(
      "NFT.Storage API key required. Set NEXT_PUBLIC_NFT_STORAGE_KEY in .env.local"
    );
  }

  return new NFTStorage({ token: key });
}

/**
 * Upload image to IPFS via NFT.Storage
 *
 * @param imageBlob - The image blob to upload
 * @returns IPFS URL (ipfs://...)
 */
export async function uploadImageToNFTStorage(
  imageBlob: Blob,
): Promise<string> {
  // Runtime check - ensure this only runs in the browser
  if (typeof window === "undefined") {
    throw new Error("uploadImageToNFTStorage can only be called in the browser");
  }

  try {
    const client = getNFTStorageClient();

    // Convert blob to File object for NFT.Storage
    const imageFile = new File([imageBlob], "ascii-art.png", {
      type: "image/png",
    });

    // Upload to IPFS
    const cid = await client.storeBlob(imageFile);

    // Return IPFS URL
    return `ipfs://${cid}`;
  } catch (error) {
    console.error("Error uploading to NFT.Storage:", error);
    throw error;
  }
}

/**
 * Upload metadata JSON to IPFS via NFT.Storage
 *
 * @param metadata - The metadata object to upload
 * @returns IPFS URL (ipfs://...)
 */
export async function uploadMetadataToNFTStorage(
  metadata: {
    name: string;
    description: string;
    image: string;
    attributes?: Array<{ trait_type: string; value: string }>;
  },
): Promise<string> {
  try {
    const client = getNFTStorageClient();

    // Convert metadata to File object
    const metadataFile = new File(
      [JSON.stringify(metadata, null, 2)],
      "metadata.json",
      {
        type: "application/json",
      }
    );

    // Upload to IPFS
    const cid = await client.storeBlob(metadataFile);

    // Return IPFS URL
    return `ipfs://${cid}`;
  } catch (error) {
    console.error("Error uploading metadata to NFT.Storage:", error);
    throw error;
  }
}

/**
 * Upload both image and metadata together (recommended for NFTs)
 * This ensures they're stored together and returns the metadata URI
 *
 * @param imageBlob - The image blob to upload
 * @param metadata - The metadata object (without image field)
 * @returns IPFS URL for metadata (ipfs://...)
 */
export async function uploadNFTToNFTStorage(
  imageBlob: Blob,
  metadata: {
    name: string;
    description: string;
    attributes?: Array<{ trait_type: string; value: string }>;
  },
): Promise<string> {
  // Runtime check - ensure this only runs in the browser
  if (typeof window === "undefined") {
    throw new Error("uploadNFTToNFTStorage can only be called in the browser");
  }

  try {
    const client = getNFTStorageClient();

    // Convert blob to File object
    const imageFile = new File([imageBlob], "ascii-art.png", {
      type: "image/png",
    });

    // Create metadata with image File object
    // NFT.Storage will upload the image and replace it with IPFS URL in metadata
    const nftMetadata = {
      ...metadata,
      image: imageFile,
    };

    // Store the NFT (uploads both image and metadata, returns metadata CID)
    const result = await client.store(nftMetadata);

    // Return IPFS URL for metadata
    // The result.url is the IPFS gateway URL, but we want ipfs:// protocol
    return `ipfs://${result.ipnft}`;
  } catch (error) {
    console.error("Error uploading NFT to NFT.Storage:", error);
    throw error;
  }
}

