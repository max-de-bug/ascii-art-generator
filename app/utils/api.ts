/**
 * API client for backend communication
 */

// API Base URL
// IMPORTANT: In production, you MUST set NEXT_PUBLIC_API_URL in Vercel environment variables
// Go to: Vercel Dashboard → Your Project → Settings → Environment Variables
// Add: NEXT_PUBLIC_API_URL = https://your-backend-url.vercel.app
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface NFT {
  id: string; // UUID from database
  mint: string;
  minter: string;
  name: string;
  symbol: string;
  uri: string;
  transactionSignature: string;
  slot: number;
  blockTime: number | null;
  timestamp: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserLevel {
  walletAddress: string;
  totalMints: number;
  level: number;
  experience: number;
  nextLevelMints: number;
  createdAt: string;
  updatedAt: string;
}

export interface Shard {
  id: string;
  name: string;
  emoji: string;
  description: string;
  earned: boolean;
  canBeLost: boolean;
}

export interface UserShardStatus {
  shards: Shard[];
  totalShards: number;
  hasZenith: boolean;
  shardsNeededForZenith: number;
}

export interface UserProfile {
  walletAddress: string;
  nfts: NFT[];
  userLevel: UserLevel;
  totalNfts: number;
}

/**
 * Get user profile with NFTs and level
 */
export async function getUserProfile(walletAddress: string): Promise<UserProfile> {
  const response = await fetch(`${API_BASE_URL}/nft/user/${walletAddress}`);
  
  if (!response.ok) {
    if (response.status === 404) {
      // User not found - return empty profile
      return {
        walletAddress,
        nfts: [],
        userLevel: {
          walletAddress,
          totalMints: 0,
          level: 1,
          experience: 0,
          nextLevelMints: 5,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        totalNfts: 0,
      };
    }
    throw new Error(`Failed to fetch user profile: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get user level
 */
export async function getUserLevel(walletAddress: string): Promise<UserLevel | null> {
  const response = await fetch(`${API_BASE_URL}/nft/user/${walletAddress}/level`);
  
  if (!response.ok) {
    // If 404, user has no level
    if (response.status === 404) {
      return null;
    }
    throw new Error(`Failed to fetch user level: ${response.statusText}`);
  }

  // Read response as text first to check if it's empty
  // This prevents "Unexpected end of JSON input" error
  const text = await response.text();
  
  // If response is empty or just "null", return null
  if (!text || text.trim() === '' || text.trim() === 'null') {
    return null;
  }

  // Parse JSON safely
  try {
    return JSON.parse(text);
  } catch (error) {
    // If JSON parsing fails, return null instead of throwing
    console.warn('Failed to parse user level response, returning null:', error);
    return null;
  }
}

/**
 * Get user shard status
 */
export async function getUserShardStatus(walletAddress: string): Promise<UserShardStatus> {
  const response = await fetch(`${API_BASE_URL}/nft/user/${walletAddress}/shard-status`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch shard status: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get NFT by mint address
 */
export async function getNftByMint(mintAddress: string): Promise<NFT | null> {
  const response = await fetch(`${API_BASE_URL}/nft/mint/${mintAddress}`);
  
  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error(`Failed to fetch NFT: ${response.statusText}`);
  }

  return response.json();
}

