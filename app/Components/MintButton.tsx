"use client";

import { Button } from "@/components/ui/button";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletIcon, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useAsciiStore } from "./store/ascii-store";
import { toast } from "sonner";
import { mintAsciiArtNFTAnchor } from "./utils/mint-nft-anchor";
import { useNetwork } from "./Providers/network-provider";
import { getProgramId, getSolscanUrl } from "./utils/network-config";

export const MintButton = () => {
  const { asciiOutput, zoom } = useAsciiStore();
  const [isMinting, setIsMinting] = useState(false);
  const { connected, publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const { network } = useNetwork();

  const handleMint = async () => {
    if (!asciiOutput) {
      toast.error("Please generate ASCII art first");
      return;
    }

    if (!connected || !publicKey || !signTransaction) {
      toast.error("Please connect your wallet to mint");
      return;
    }

    try {
      setIsMinting(true);
      toast.loading("Creating image...", { id: "mint" });

      // Create image blob
      const { createImageBlob } = await import("./AsciiActions");
      const imageBlob = await createImageBlob(asciiOutput, zoom, "#000000");

      if (!imageBlob) {
        toast.error("Failed to create image", { id: "mint" });
        return;
      }

      toast.loading("Uploading to IPFS...", { id: "mint" });

      // Get network-specific program ID
      const programId = getProgramId(network);

      toast.loading("Minting NFT via Anchor program...", { id: "mint" });

      // Mint NFT using Anchor program
      // NFT.Storage API key is read from NEXT_PUBLIC_NFT_STORAGE_KEY env var
      // You can also pass it explicitly via nftStorageKey parameter
      const { mint, signature } = await mintAsciiArtNFTAnchor({
        connection,
        wallet: publicKey,
        signTransaction: async (tx) => {
          return await signTransaction(tx);
        },
        asciiArt: asciiOutput,
        imageBlob,
        programId,
        name: "ASCII Art",
        description: "Generated ASCII art NFT",
        // nftStorageKey is optional - defaults to NEXT_PUBLIC_NFT_STORAGE_KEY from env
      });

      const solscanUrl = getSolscanUrl(signature, network);
      toast.success(
        `ASCII art minted successfully! View on Solscan: ${solscanUrl}`,
        { id: "mint", duration: 10000 }
      );

      console.log("Mint address:", mint.toString());
      console.log("Transaction signature:", signature);
    } catch (error: any) {
      console.error("Minting error:", error);
      toast.error(
        error?.message || "Failed to mint ASCII art. Please try again.",
        { id: "mint" }
      );
    } finally {
      setIsMinting(false);
    }
  };

  // Determine button state and content
  const { text, disabled, icon } = useMemo(() => {
    if (!asciiOutput) {
      return {
        text: "Please generate an ASCII art first",
        disabled: true,
        icon: null as React.ReactNode,
      };
    }

    if (isMinting) {
      return {
        text: "Minting...",
        disabled: true,
        icon: (<Loader2 className="size-4 animate-spin" />) as React.ReactNode,
      };
    }

    if (!connected || !publicKey) {
      return {
        text: "Connect your wallet to mint",
        disabled: true,
        icon: (<WalletIcon className="size-4" />) as React.ReactNode,
      };
    }

    return {
      text: "Mint the art",
      disabled: false,
      icon: null as React.ReactNode,
    };
  }, [asciiOutput, isMinting, connected, publicKey, signTransaction]);

  return (
    <div className="mt-4 flex justify-center">
      <Button
        onClick={handleMint}
        disabled={disabled || isMinting}
        aria-busy={isMinting}
        aria-disabled={disabled || isMinting}
        className="w-full sm:w-[50%] bg-zinc-900 dark:bg-zinc-800 text-white hover:bg-zinc-800 dark:hover:bg-zinc-700 font-bold text-sm uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer px-8 py-4 rounded-sm border-0"
      >
        <span className="flex items-center justify-center gap-2">
          {icon && <span>{icon}</span>}
          {text.toUpperCase()}
        </span>
      </Button>
    </div>
  );
};
