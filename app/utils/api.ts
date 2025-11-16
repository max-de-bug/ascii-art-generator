/**
 * API client for backend communication
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface NFT {
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
export async function getUserLevel(walletAddress: string): Promise<UserLevel> {
  const response = await fetch(`${API_BASE_URL}/nft/user/${walletAddress}/level`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch user level: ${response.statusText}`);
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

