"use client";
import { Button } from "@/components/ui/button";
import { CopyIcon, DownloadIcon, ShareIcon } from "lucide-react";
import { useAsciiStore } from "./store/ascii-store";
import { toast } from "sonner";
import { memo } from "react";

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

// Export createImageBlob for use in other components (e.g., MintButton)
export const createImageBlob = (
  asciiOutput: string,
  zoom: number[],
  backgroundColor: string = "#000000"
): Promise<Blob | null> => {
  // Early return checks (synchronous - no Promise needed)
  if (!asciiOutput) {
    return Promise.resolve(null);
  }

  const lines = asciiOutput
    .split("\n")
    .filter((line) => line.length > 0);
  
  // Also check if there's any non-whitespace content at all
  const hasContent = lines.some((line) => line.trim().length > 0);
  
  if (lines.length === 0) {
    console.warn("createImageBlob: ASCII output has no lines");
    return Promise.resolve(null);
  }
  
  if (!hasContent) {
    console.warn("createImageBlob: ASCII output is all whitespace, but still creating image");
    // Still proceed - whitespace-only ASCII art is valid (could be minimal art)
  }

  // Use minimal padding to maximize canvas usage
  const padding = 20;
  const baseFontSize = (zoom[0] / 100) * 12;
  const lineHeightMultiplier = 1.1;

  // Get device pixel ratio for high-DPI displays (default to 2 for high quality)
  const devicePixelRatio = window.devicePixelRatio || 2;
  const scaleFactor = Math.max(devicePixelRatio, 2); // Minimum 2x for quality

  // Calculate canvas dimensions
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) {
    return Promise.resolve(null);
  }

  // First pass: measure text with base font size
  ctx.font = `600 ${baseFontSize}px "Geist Mono", monospace`;
  ctx.textBaseline = "top";

  let maxWidth = 0;
  lines.forEach((line) => {
    const metrics = ctx.measureText(line);
    maxWidth = Math.max(maxWidth, metrics.width);
  });

  const baseLineHeight = baseFontSize * lineHeightMultiplier;
  const baseHeight = lines.length * baseLineHeight;

  // Calculate target canvas size (use text dimensions with minimal padding)
  // Scale to ensure text fills the canvas better
  const targetWidth = maxWidth + padding * 2;
  const targetHeight = baseHeight + padding * 2;

  // Set canvas internal size (scaled for high-DPI)
  canvas.width = targetWidth * scaleFactor;
  canvas.height = targetHeight * scaleFactor;

  // Set canvas display size (CSS pixels)
  canvas.style.width = `${targetWidth}px`;
  canvas.style.height = `${targetHeight}px`;

  // Scale the context to match device pixel ratio
  ctx.scale(scaleFactor, scaleFactor);

  // Re-apply context settings after canvas resize (resetting canvas clears context)
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, targetWidth, targetHeight);

  // Draw text (left-aligned with padding) - ensure contrast with background
  ctx.fillStyle =
    backgroundColor.toLowerCase() === "#000000" ? "#ffffff" : "#000000";
  ctx.font = `600 ${baseFontSize}px "Geist Mono", monospace`;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";

  const lineHeight = baseFontSize * lineHeightMultiplier;
  lines.forEach((line, index) => {
    const x = padding;
    const y = padding + index * lineHeight;
    ctx.fillText(line, x, y);
  });

  // Add watermark in bottom-right corner
  const watermarkText = "powered by O.XYZ";
  const watermarkFontSize = Math.max(baseFontSize * 0.5, 10); // 50% of base font, minimum 10px
  ctx.font = `400 ${watermarkFontSize}px "Geist Mono", monospace`;
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  
  // Use semi-transparent text with good contrast
  const watermarkOpacity = 0.6;
  const isDarkBackground = backgroundColor.toLowerCase() === "#000000";
  ctx.fillStyle = isDarkBackground
    ? `rgba(255, 255, 255, ${watermarkOpacity})`
    : `rgba(0, 0, 0, ${watermarkOpacity})`;
  
  // Position in bottom-right with padding
  const watermarkPadding = 12;
  const watermarkX = targetWidth - watermarkPadding;
  const watermarkY = targetHeight - watermarkPadding;
  
  ctx.fillText(watermarkText, watermarkX, watermarkY);



  // Convert to PNG blob - Promise is only needed here because toBlob uses a callback
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    }, "image/png");
  });
};

export const AsciiActions = memo(({ asciiOutput }: AsciiActionsProps) => {
  // Use selector to only subscribe to zoom, preventing unnecessary rerenders
  const zoom = useAsciiStore((state) => state.zoom);

  const copyToClipboard = () => {
    if (!asciiOutput) return;
    navigator.clipboard.writeText(asciiOutput);
  };

  const createImageBlobLocal = (
    backgroundColor: string = "#000000"
  ): Promise<Blob | null> => {
    return createImageBlob(asciiOutput, zoom, backgroundColor);
  };

  const shareToTwitter = async () => {
    if (!asciiOutput) return;

    try {
      // Create the image blob
      const blob = await createImageBlobLocal();
      if (!blob) {
        toast.error("Failed to create image. Please try again.");
        return;
      }

      // Check if Clipboard API is available
      if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
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
      const text = `🎨 Just created this amazing ASCII art! Check it out 👇\n\n(Paste the image below with Ctrl+V or Cmd+V)`;
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
    }
  };

  const downloadAsFile = async () => {
    if (!asciiOutput) return;

    const blob = await createImageBlobLocal();
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
        className="bg-zinc-900 dark:bg-zinc-800 text-white hover:bg-zinc-800 dark:hover:bg-zinc-700 font-bold text-xs uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer px-6 py-3 rounded-sm border-0"
        style={{ fontFamily: "var(--font-pixel), var(--font-press-start), monospace", fontWeight: 600, letterSpacing: "0.05em" }}
      >
        <span className="flex items-center gap-2">
          <CopyIcon className="size-4" />
          Copy
        </span>
      </Button>
      <Button
        onClick={downloadAsFile}
        disabled={!asciiOutput}
        className="bg-zinc-900 dark:bg-zinc-800 text-white hover:bg-zinc-800 dark:hover:bg-zinc-700 font-bold text-xs uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer px-6 py-3 rounded-sm border-0"
        style={{ fontFamily: "var(--font-pixel), var(--font-press-start), monospace", fontWeight: 600, letterSpacing: "0.05em" }}
      >
        <span className="flex items-center gap-2">
          <DownloadIcon className="size-4" />
          Download
        </span>
      </Button>

      <Button
        onClick={shareToTwitter}
        disabled={!asciiOutput}
        className="bg-zinc-900 dark:bg-zinc-800 text-white hover:bg-zinc-800 dark:hover:bg-zinc-700 font-bold text-xs uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer px-6 py-3 rounded-sm border-0"
        style={{ fontFamily: "var(--font-pixel), var(--font-press-start), monospace", fontWeight: 600, letterSpacing: "0.05em" }}
      >
        <span className="flex items-center gap-2">
          Share on
          <XIcon className="size-4" />
        </span>
      </Button>
    </div>
  );
});

AsciiActions.displayName = "AsciiActions";
