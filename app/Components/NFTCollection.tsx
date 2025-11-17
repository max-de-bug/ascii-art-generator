import { ImageIcon } from "lucide-react";
import Link from "next/link";
import { NFT } from "../utils/api";

interface NFTCollectionProps {
    isLoading: boolean;
    nfts: NFT[];
}

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
                            <div className="aspect-square bg-muted rounded-lg mb-3 flex items-center justify-center">
                                <ImageIcon className="h-12 w-12 text-muted-foreground" />
                            </div>
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