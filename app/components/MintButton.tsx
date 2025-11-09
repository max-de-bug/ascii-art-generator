"use client";

import { Button } from "@/components/ui/button";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletIcon, Loader2 } from "lucide-react";
import { useState } from "react";
import { useAsciiStore } from "./store/ascii-store";
import { toast } from "sonner";

export const MintButton = () => {
  const { asciiOutput } = useAsciiStore();
  const [isMinting, setIsMinting] = useState(false);
  const { connected, publicKey } = useWallet();

  const handleMint = async () => {
    if (!asciiOutput) {
      toast.error("Please generate ASCII art first");
      return;
    }

    if (!connected || !publicKey) {
      toast.error("Please connect your wallet to mint");
      return;
    }

    try {
      setIsMinting(true);

      // TODO: Implement actual minting logic here
      // This is a placeholder for the minting functionality
      console.log("Minting art:", asciiOutput);
      console.log("Wallet:", publicKey.toString());

      // Simulate minting process
      await new Promise((resolve) => setTimeout(resolve, 2000));

      toast.success("ASCII art minted successfully!");
    } catch (error) {
      console.error("Minting error:", error);
      toast.error("Failed to mint ASCII art. Please try again.");
    } finally {
      setIsMinting(false);
    }
  };

  // Determine button state and content
  const getButtonContent = () => {
    if (!asciiOutput) {
      return {
        text: "Please generate an ASCII art first",
        disabled: true,
        icon: null,
      };
    }

    if (isMinting) {
      return {
        text: "Minting...",
        disabled: true,
        icon: <Loader2 className="size-4 animate-spin" />,
      };
    }

    if (!connected || !publicKey) {
      return {
        text: "Connect your wallet to mint",
        disabled: true,
        icon: <WalletIcon className="size-4" />,
      };
    }

    return {
      text: "Mint the art",
      disabled: false,
      icon: null,
    };
  };

  const { text, disabled, icon } = getButtonContent();

  return (
    <div className="mt-4 flex justify-center">
      <Button
        onClick={handleMint}
        disabled={disabled || isMinting}
        className="w-full sm:w-[50%] bg-primary hover:bg-primary/80 text-primary-foreground font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
      >
        {icon && <span className="mr-2">{icon}</span>}
        {text}
      </Button>
    </div>
  );
};
