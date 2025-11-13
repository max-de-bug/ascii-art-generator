"use client";

import { Button } from "@/components/ui/button";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletIcon, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useAsciiStore } from "./store/ascii-store";
import { toast } from "sonner";
import { mintAsciiArtNFTAnchor } from "./utils/mint-nft-anchor";
import { PublicKey } from "@solana/web3.js";

export const MintButton = () => {
  const { asciiOutput, zoom } = useAsciiStore();
  const [isMinting, setIsMinting] = useState(false);
  const { connected, publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();

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

      // Get program ID from environment or use default
      // You should set this in your .env.local: NEXT_PUBLIC_ANCHOR_PROGRAM_ID
      const programId = new PublicKey(
        process.env.NEXT_PUBLIC_ANCHOR_PROGRAM_ID ||
          "56cKjpFg9QjDsRCPrHnj1efqZaw2cvfodNhz4ramoXxt"
      );

      toast.loading("Minting NFT via Anchor program...", { id: "mint" });

      // Mint NFT using Anchor program
      // Note: bundlrPrivateKey should be passed if you have it set up
      // Otherwise, you'll need to set BUNDLR_PRIVATE_KEY in .env.local (server-side)
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
        // bundlrPrivateKey: process.env.NEXT_PUBLIC_BUNDLR_PRIVATE_KEY, // Optional: if you want to expose it (not recommended)
        bundlrNetwork: process.env.NEXT_PUBLIC_BUNDLR_NETWORK as
          | "mainnet"
          | "devnet"
          | undefined,
      });

      toast.success(
        `ASCII art minted successfully! View on Solscan: https://solscan.io/tx/${signature}`,
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
        className="w-full sm:w-[50%] bg-primary hover:bg-primary/80 text-primary-foreground font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
      >
        {icon && <span className="mr-2">{icon}</span>}
        {text}
      </Button>
    </div>
  );
};
