"use client";
import { Button } from "@/components/ui/button";
import { CopyIcon, DownloadIcon, ShareIcon } from "lucide-react";
import { useAsciiStore } from "./store/ascii-store";

interface AsciiActionsProps {
  asciiOutput: string;
}

export const AsciiActions = ({ asciiOutput }: AsciiActionsProps) => {
  const { zoom } = useAsciiStore();

  const copyToClipboard = () => {
    if (!asciiOutput) return;
    navigator.clipboard.writeText(asciiOutput);
  };

  const downloadAsFile = () => {
    if (!asciiOutput) return;

    const lines = asciiOutput.split("\n");
    const fontSize = (zoom[0] / 100) * 12;
    const lineHeight = fontSize * 1.1;
    const padding = 40;

    // Calculate canvas dimensions
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

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

    lines.forEach((line, index) => {
      const x = canvas.width / 2;
      const y = padding + index * lineHeight;
      ctx.fillText(line, x, y);
    });

    // Convert to PNG and download
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const element = document.createElement("a");
      element.href = url;
      element.download = "ascii-art.png";
      element.style.display = "none";
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      URL.revokeObjectURL(url);
    }, "image/png");
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
      >
        <ShareIcon className="size-4" />
        Share
      </Button>
    </div>
  );
};
