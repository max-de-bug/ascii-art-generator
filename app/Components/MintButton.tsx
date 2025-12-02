"use client";

import { Button } from "@/components/ui/button";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletIcon, Loader2 } from "lucide-react";
import { useMemo, useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAsciiStore } from "./store/ascii-store";
import { toast } from "sonner";
import { mintAsciiArtNFTAnchor } from "./utils/mint-nft-anchor";
import { useNetwork } from "./Providers/network-provider";
import { getProgramId, getSolscanUrl } from "./utils/network-config";
import { createImageBlob } from "./AsciiActions";

export const MintButton = () => {
  const { asciiOutput, zoom, imageFile, inputText } = useAsciiStore();
  const [isMinting, setIsMinting] = useState(false);
  const { connected, publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const { network } = useNetwork();
  const queryClient = useQueryClient();
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track if a source is loaded to prevent flickering during regeneration
  const hasSource = !!(imageFile || inputText?.trim());
  
  // Cache whether we have valid output to prevent flickering
  const hasValidOutputRef = useRef(false);
  useEffect(() => {
    if (asciiOutput) {
      hasValidOutputRef.current = true;
    } else if (!hasSource) {
      // Only reset when source is removed
      hasValidOutputRef.current = false;
    }
  }, [asciiOutput, hasSource]);
  
  // Consider output valid if we have current output OR (source is loaded AND we had output before)
  const hasOutput = asciiOutput || (hasSource && hasValidOutputRef.current);

  const handleMint = async () => {
    // Prevent action if already minting
    if (isMinting) {
      return;
    }

    if (!asciiOutput) {
      toast.error("Upload the image or type the text");
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
      const imageBlob = await createImageBlob(asciiOutput, zoom, "#000000");

      if (!imageBlob) {
        toast.error("Failed to create image", { id: "mint" });
        setIsMinting(false);
        return;
      }

      toast.loading("Uploading to IPFS...", { id: "mint" });

      // Get network-specific program ID
      const programId = getProgramId(network);

      toast.loading("Minting ASCII art NFT...", { id: "mint" });

      // Helper function to check if error is a user rejection
      const isUserRejectionError = (error: any): boolean => {
        return (
          error?.name === "WalletSignTransactionError" ||
          error?.constructor?.name === "WalletSignTransactionError" ||
          error?.message?.toLowerCase().includes("rejected") ||
          error?.message?.toLowerCase().includes("denied") ||
          error?.message?.toLowerCase().includes("user rejected") ||
          error?.message?.toLowerCase().includes("user cancelled") ||
          error?.message?.toLowerCase().includes("cancelled") ||
          error?.code === 4001 ||
          error?.code === "ACTION_REJECTED" ||
          error?.code === "USER_REJECTED"
        );
      };

      // Temporarily suppress console errors for user rejections
      const originalConsoleError = console.error;
      let suppressedError: any = null;
      
      console.error = (...args: any[]) => {
        const errorMessage = args[0]?.toString() || '';
        // Suppress WalletSignTransactionError console logs (user rejections are expected)
        if (
          errorMessage.includes("WalletSignTransactionError") ||
          errorMessage.includes("User rejected") ||
          errorMessage.includes("User cancelled")
        ) {
          suppressedError = args[0];
          return; // Suppress the console error
        }
        originalConsoleError.apply(console, args);
      };

      try {
        const { mint, signature } = await mintAsciiArtNFTAnchor({
          connection,
          wallet: publicKey,
          signTransaction: async (tx) => {
            try {
              return await signTransaction(tx);
            } catch (error: any) {
              // Check if this is a user rejection
              if (isUserRejectionError(error)) {
                // Create a clean error object for user rejection
                const rejectionError: any = new Error("User rejected the transaction");
                rejectionError.name = "WalletSignTransactionError";
                rejectionError.isUserRejection = true;
                throw rejectionError;
              }
              throw error;
            }
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
        // Check if this is a user rejection (either from our wrapper or suppressed error)
        const isUserRejection = isUserRejectionError(error) || suppressedError !== null;
        
        if (isUserRejection) {
          // Don't log user rejections - they're expected behavior
          toast.info("Transaction cancelled", {
            id: "mint",
            duration: 3000,
          });
        } else {
          // Only log actual errors (console.error will be restored in finally)
          originalConsoleError("Minting error:", error);
          toast.error(
            error?.message || "Failed to mint ASCII art. Please try again.",
            { id: "mint" }
          );
        }
      } finally {
        // Always restore console.error and reset minting state
        console.error = originalConsoleError;
        setIsMinting(false);
      }
    } catch (error: any) {
      // Handle any errors from image creation or other early steps
      console.error("Error in mint process:", error);
      toast.error(
        error?.message || "Failed to mint ASCII art. Please try again.",
        { id: "mint" }
      );
      setIsMinting(false);
    }
  };

  // Determine button state and content
  // Use hasOutput (cached) instead of asciiOutput to prevent flickering during regeneration
  const { text, disabled, icon } = useMemo(() => {
    if (!hasOutput) {
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
  }, [hasOutput, isMinting, connected, publicKey, signTransaction]);

  return (
    <div className="mt-4 flex justify-center">
      <Button
        onClick={handleMint}
        aria-busy={isMinting}
        aria-disabled={disabled || isMinting}
        className={`w-full sm:w-[50%] bg-zinc-900 dark:bg-zinc-800 text-white hover:bg-zinc-800 dark:hover:bg-zinc-700 font-bold text-sm uppercase tracking-wider transition-all duration-200 cursor-pointer px-8 py-4 border-0 ${
          disabled || isMinting ? "opacity-50 cursor-not-allowed" : ""
        }`}
        style={{ 
          fontFamily: "var(--font-pixel), var(--font-press-start), monospace", 
          fontWeight: 600, 
          letterSpacing: "0.05em",
          borderRadius: "20px",
          boxShadow: "inset 0px -4px 2px rgba(0, 0, 0, 0.4), inset 0px 3px 1px rgba(255, 255, 255, 0.1), inset -1px -6px 6px rgba(0, 0, 0, 0.5)"
        }}
      >
        <span className="flex items-center justify-center gap-2">
          {icon && <span>{icon}</span>}
          {text.toUpperCase()}
        </span>
      </Button>
    </div>
  );
};
