"use client";
import { Button } from "@/components/ui/button";
import { CopyIcon, DownloadIcon, ShareIcon } from "lucide-react";
import { useAsciiStore } from "./store/ascii-store";
import { toast } from "sonner";

// Custom X (Twitter) icon component
const XIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

interface AsciiActionsProps {
  asciiOutput: string;
}

export const AsciiActions = ({ asciiOutput }: AsciiActionsProps) => {
  const { zoom } = useAsciiStore();

  const copyToClipboard = () => {
    if (!asciiOutput) return;
    navigator.clipboard.writeText(asciiOutput);
  };

  const createImageBlob = (): Promise<Blob | null> => {
    // Early return checks (synchronous - no Promise needed)
    if (!asciiOutput) {
      return Promise.resolve(null);
    }

    const lines = asciiOutput.split("\n");
    const fontSize = (zoom[0] / 100) * 12;
    const lineHeight = fontSize * 1.1;
    const padding = 40;

    // Calculate canvas dimensions
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) {
      return Promise.resolve(null);
    }

    ctx.font = `600 ${fontSize}px "Geist Mono", monospace`;
    ctx.textBaseline = "top";

    // Measure text to determine canvas size
    let maxWidth = 0;
    lines.forEach((line) => {
      const metrics = ctx.measureText(line);
      maxWidth = Math.max(maxWidth, metrics.width);
    });

    canvas.width = maxWidth + padding * 2;
    canvas.height = lines.length * lineHeight + padding * 2;

    // Set background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw text (centered horizontally)
    ctx.fillStyle = "#000000";
    ctx.font = `600 ${fontSize}px "Geist Mono", monospace`;
    ctx.textBaseline = "top";
    ctx.textAlign = "center";
    ctx.letterSpacing = "-0.5px";

    lines.forEach((line, index) => {
      const x = canvas.width / 2;
      const y = padding + index * lineHeight;
      ctx.fillText(line, x, y);
    });

    // Convert to PNG blob - Promise is only needed here because toBlob uses a callback
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, "image/png");
    });
  };

  const shareToTwitter = async () => {
    if (!asciiOutput) return;

    try {
      // Create the image blob
      const blob = await createImageBlob();
      if (!blob) {
        toast.error("Failed to create image. Please try again.");
        return;
      }

      // Check if Clipboard API is available
      if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
        // Fallback: open Twitter and show instructions
        const text = `Check out this ASCII art I generated!`;
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
          text
        )}`;
        window.open(twitterUrl, "_blank");
        toast.error(
          "Clipboard API not supported. Please download the image and upload it manually to Twitter."
        );
        return;
      }

      // Copy image to clipboard
      const clipboardItem = new ClipboardItem({
        "image/png": blob,
      });

      await navigator.clipboard.write([clipboardItem]);

      // Open Twitter compose window
      const text = `Check out this ASCII art I generated!`;
      const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        text
      )}`;
      window.open(twitterUrl, "_blank");

      // Show success message (toast is non-blocking, so no setTimeout needed)
      toast.success(
        "Image copied to clipboard! Paste it in the Twitter compose window (Ctrl+V or Cmd+V)."
      );
    } catch (error) {
      console.error("Failed to copy image to clipboard:", error);
      // Fallback: download the image
      toast.error(
        "Failed to copy to clipboard. The image will be downloaded instead. You can then upload it to Twitter manually."
      );
      downloadAsFile();
    }
  };

  const downloadAsFile = async () => {
    if (!asciiOutput) return;

    const blob = await createImageBlob();
    if (!blob) {
      toast.error("Failed to create image. Please try again.");
      return;
    }

    // Download the image
    const url = URL.createObjectURL(blob);
    const element = document.createElement("a");
    element.href = url;
    element.download = "ascii-art.png";
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex gap-3 justify-center pt-6">
      <Button
        onClick={copyToClipboard}
        disabled={!asciiOutput}
        className="px-6 py-2 bg-primary hover:bg-primary/80 text-primary-foreground font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs uppercase tracking-wide cursor-pointer"
      >
        <CopyIcon className="size-4" />
        Copy
      </Button>
      <Button
        onClick={downloadAsFile}
        disabled={!asciiOutput}
        className="px-6 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs uppercase tracking-wide cursor-pointer"
      >
        <DownloadIcon className="size-4" />
        Download
      </Button>

      <Button
        variant="outline"
        className="px-6 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs uppercase tracking-wide cursor-pointer"
        disabled={!asciiOutput}
        onClick={shareToTwitter}
      >
        Share on
        <XIcon className="size-4" />
      </Button>
    </div>
  );
};
