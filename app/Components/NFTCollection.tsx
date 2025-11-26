"use client";

import { ImageIcon } from "lucide-react";
import Link from "next/link";
import { NFT } from "../utils/api";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";

interface NFTMetadata {
    name: string;
    description: string;
    image: string;
    attributes?: Array<{ trait_type: string; value: string }>;
}

interface NFTCollectionProps {
    isLoading: boolean;
    nfts: NFT[];
}

// Extract IPFS hash from URI (handles various formats)
const extractIPFSHash = (uri: string): string | null => {
    // Handle ipfs:// protocol
    if (uri.startsWith('ipfs://')) {
        return uri.replace('ipfs://', '').split('/')[0].split('?')[0];
    }
    
    // Handle /ipfs/ path format
    const pathMatch = uri.match(/\/ipfs\/([^/?]+)/);
    if (pathMatch) {
        return pathMatch[1];
    }
    
    // Handle gateway URLs (e.g., https://gateway.lighthouse.storage/ipfs/QmHash)
    const gatewayMatch = uri.match(/ipfs\/([^/?]+)/);
    if (gatewayMatch) {
        return gatewayMatch[1];
    }
    
    // Handle direct hash (Qm... or baf...)
    if ((uri.startsWith('Qm') || uri.startsWith('baf')) && uri.length > 40) {
        return uri.split('/')[0].split('?')[0];
    }
    
    return null;
};

// List of IPFS gateways to try as fallbacks
const IPFS_GATEWAYS = [
    'https://gateway.lighthouse.storage/ipfs',
    'https://ipfs.io/ipfs',
    'https://cloudflare-ipfs.com/ipfs',
    'https://gateway.pinata.cloud/ipfs',
    'https://dweb.link/ipfs',
];

// Fetch NFT metadata using React Query with gateway fallbacks
const fetchNFTMetadata = async (uri: string): Promise<NFTMetadata> => {
    const ipfsHash = extractIPFSHash(uri);
    
    // If we can extract an IPFS hash, try multiple gateways
    if (ipfsHash) {
        let lastError: Error | null = null;
        
        for (const gateway of IPFS_GATEWAYS) {
            try {
                const gatewayUrl = `${gateway}/${ipfsHash}`;
                
                // Create abort controller for timeout
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
                
                try {
                    const response = await fetch(gatewayUrl, {
                        cache: 'no-cache',
                        signal: controller.signal,
                    });
                    
                    clearTimeout(timeoutId);
                    
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }
                    
                    const metadata: NFTMetadata = await response.json();
                    
                    if (!metadata.image) {
                        throw new Error("No image found in metadata");
                    }
                    
                    // Normalize image URL if it's an IPFS hash
                    // Use the same gateway that successfully fetched the metadata
                    if (metadata.image.startsWith('ipfs://')) {
                        const imageHash = metadata.image.replace('ipfs://', '');
                        metadata.image = `${gateway}/${imageHash}`;
                    } else if (metadata.image.startsWith('/ipfs/')) {
                        const imageHash = metadata.image.replace('/ipfs/', '');
                        metadata.image = `${gateway}/${imageHash}`;
                    } else if (metadata.image.includes('gateway.lighthouse.storage')) {
                        // If image URL is already a Lighthouse URL, try to extract hash and use current gateway
                        const imageHash = extractIPFSHash(metadata.image);
                        if (imageHash) {
                            metadata.image = `${gateway}/${imageHash}`;
                        }
                    }
                    
                    return metadata;
                } catch (fetchError: any) {
                    clearTimeout(timeoutId);
                    
                    // Check if it's a network error that we should retry with next gateway
                    const isNetworkError = 
                        fetchError.name === 'AbortError' ||
                        fetchError.message?.includes('ERR_CONNECTION_RESET') ||
                        fetchError.message?.includes('ERR_NAME_NOT_RESOLVED') ||
                        fetchError.message?.includes('Failed to fetch') ||
                        fetchError.message?.includes('NetworkError') ||
                        fetchError.message?.includes('HTTP 5');
                    
                    if (isNetworkError) {
                        lastError = fetchError;
                        continue; // Try next gateway
                    }
                    
                    // For other errors, also try next gateway
                    lastError = fetchError;
                }
            } catch (error: any) {
                lastError = error;
                continue;
            }
        }
        
        // If all gateways failed, throw the last error
        throw lastError || new Error('All IPFS gateways failed');
    }
    
    // Fallback: try direct fetch if we can't extract IPFS hash
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    try {
        const response = await fetch(uri, {
            cache: 'no-cache',
            signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch metadata: ${response.statusText}`);
        }
        
        const metadata: NFTMetadata = await response.json();
        
        if (!metadata.image) {
            throw new Error("No image found in metadata");
        }
        
        return metadata;
    } catch (error: any) {
        clearTimeout(timeoutId);
        throw new Error(`Failed to fetch metadata: ${error.message}`);
    }
};

// Normalize image URL to use working gateway
const normalizeImageUrl = (imageUrl: string, preferredGateway?: string): string => {
    // Extract IPFS hash from image URL
    const imageHash = extractIPFSHash(imageUrl);
    
    if (imageHash) {
        // Use preferred gateway if provided, otherwise use first gateway
        const gateway = preferredGateway || IPFS_GATEWAYS[0];
        return `${gateway}/${imageHash}`;
    }
    
    // If we can't extract hash, return as-is
    return imageUrl;
};

// Component to fetch and display NFT image using React Query
const NFTImage = ({ uri, name }: { uri: string; name: string }) => {
    const [imageError, setImageError] = useState(false);
    const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
    
    const { data: metadata, isLoading, error } = useQuery<NFTMetadata>({
        queryKey: ["nftMetadata", uri],
        queryFn: () => fetchNFTMetadata(uri),
        enabled: !!uri,
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
        retry: 1, // Only retry once since we handle fallbacks internally
    });

    // Update image URL when metadata loads
    useEffect(() => {
        if (metadata?.image) {
            // Extract the gateway that was used to fetch metadata (if available)
            // For now, start with first gateway and let error handler try others
            const normalizedUrl = normalizeImageUrl(metadata.image);
            console.log(`[NFTImage] Loading image for ${name} from: ${normalizedUrl}`);
            setCurrentImageUrl(normalizedUrl);
            setImageError(false);
        }
    }, [metadata?.image, name]);

    // Try next gateway if image fails to load
    const handleImageError = () => {
        if (!metadata?.image) {
            console.warn(`[NFTImage] No image URL in metadata for ${name}`);
            setImageError(true);
            return;
        }
        
        if (imageError) {
            // Already tried all gateways
            console.warn(`[NFTImage] All gateways failed for ${name}`);
            return;
        }
        
        const imageHash = extractIPFSHash(metadata.image);
        if (imageHash && currentImageUrl) {
            // Find current gateway index
            const currentGatewayIndex = IPFS_GATEWAYS.findIndex(gateway => 
                currentImageUrl.includes(gateway)
            );
            
            // Try next gateway
            if (currentGatewayIndex >= 0 && currentGatewayIndex < IPFS_GATEWAYS.length - 1) {
                const nextGateway = IPFS_GATEWAYS[currentGatewayIndex + 1];
                const nextUrl = `${nextGateway}/${imageHash}`;
                console.log(`[NFTImage] Gateway ${IPFS_GATEWAYS[currentGatewayIndex]} failed, trying ${nextGateway} for ${name}`);
                setCurrentImageUrl(nextUrl);
                setImageError(false);
            } else {
                console.warn(`[NFTImage] All gateways exhausted for ${name}`);
                setImageError(true);
            }
        } else {
            console.warn(`[NFTImage] Could not extract IPFS hash from image URL: ${metadata.image}`);
            setImageError(true);
        }
    };

    if (isLoading) {
        return (
            <div className="aspect-square bg-muted rounded-lg mb-3 flex items-center justify-center animate-pulse">
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
            </div>
        );
    }

    if (error || !metadata?.image) {
        return (
            <div className="aspect-square bg-muted rounded-lg mb-3 flex items-center justify-center">
                <ImageIcon className="h-12 w-12 text-muted-foreground" />
            </div>
        );
    }

    if (imageError || !currentImageUrl) {
        return (
            <div className="aspect-square bg-muted rounded-lg mb-3 flex items-center justify-center">
                <ImageIcon className="h-12 w-12 text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="aspect-square bg-muted rounded-lg mb-3 overflow-hidden relative">
            {/* Use regular img tag for better error handling with IPFS */}
            <img
                src={currentImageUrl}
                alt={name}
                className="w-full h-full object-contain"
                onError={handleImageError}
                loading="lazy"
            />
        </div>
    );
};

export const NFTCollection = ({ isLoading, nfts }: NFTCollectionProps) => {
    return (
        <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Your ASCII Art Collection
            </h2>

            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className="rounded-lg border border-border bg-card p-4 animate-pulse"
                        >
                            <div className="aspect-square bg-muted rounded-lg mb-3" />
                            <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                            <div className="h-3 bg-muted rounded w-1/2" />
                        </div>
                    ))}
                </div>
            ) : nfts.length === 0 ? (
                <div className="rounded-lg border border-border bg-card p-8 text-center">
                    <ImageIcon className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground mb-2">
                        No NFTs minted yet
                    </p>
                    <p className="text-sm text-muted-foreground">
                        Start minting ASCII art to build your collection!
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {nfts.map((nft) => (
                        <Link
                            key={nft.mint}
                            href={`https://solscan.io/token/${nft.mint}?cluster=mainnet-beta`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg border border-border bg-card p-4 hover:border-primary transition-colors"
                        >
                            <NFTImage uri={nft.uri} name={nft.name} />
                            <h3 className="font-semibold mb-1 truncate">{nft.name}</h3>
                            <p className="text-sm text-muted-foreground mb-2">
                                {nft.symbol}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                                {new Date(nft.blockTime ? nft.blockTime * 1000 : nft.createdAt).toLocaleDateString()}
                            </p>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
};