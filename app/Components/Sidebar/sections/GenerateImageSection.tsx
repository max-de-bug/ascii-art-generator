"use client";
import { Input } from "@/components/ui/input";
import { useRef, useState, useEffect, useCallback } from "react";
import { useAsciiStore } from "../../store/ascii-store";
import { Label } from "@/components/ui/label";
import Image from "next/image";
import { generateAsciiFromImage } from "../../utils/ascii-converter";
import { Button } from "@/components/ui/button";
import { TrashIcon } from "lucide-react";
export const GenerateImageSection = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const {
    imageFile,
    setImageFile,
    asciiWidth,
    brightness,
    contrast,
    blur,
    invert,
    charset,
    manualChar,
    ignoreWhite,
    dithering,
    ditherAlgorithm,
    edgeMethod,
    edgeThreshold,
    dogThreshold,
    setAsciiOutput,
  } = useAsciiStore();

  // Load image data when file changes
  useEffect(() => {
    if (imageFile) {
      const url = URL.createObjectURL(imageFile);
      setPreviewUrl(url);

      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        const dataUrl = e.target?.result as string;
        setImageDataUrl(dataUrl);
      };
      reader.readAsDataURL(imageFile);

      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
      setImageDataUrl(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [imageFile]);

  // Real-time regeneration function - updates immediately on settings change
  const regenerateAscii = useCallback(() => {
    if (!imageDataUrl) return;

    generateAsciiFromImage(imageDataUrl, {
      asciiWidth,
      brightness,
      contrast,
      blur,
      invert,
      charset,
      manualChar,
      ignoreWhite,
      dithering,
      ditherAlgorithm,
      edgeMethod,
      edgeThreshold,
      dogThreshold,
      setAsciiOutput,
    });
  }, [
    imageDataUrl,
    asciiWidth,
    brightness,
    contrast,
    blur,
    invert,
    charset,
    manualChar,
    ignoreWhite,
    dithering,
    ditherAlgorithm,
    edgeMethod,
    edgeThreshold,
    dogThreshold,
    setAsciiOutput,
  ]);

  // Real-time regeneration using requestAnimationFrame for smooth updates
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!imageDataUrl) return;

    // Cancel any pending frame before scheduling a new one
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }

    rafIdRef.current = requestAnimationFrame(() => {
      regenerateAscii();
      rafIdRef.current = null;
    });

    return () => {
      // Cleanup: cancel pending frame when effect re-runs or component unmounts
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [imageDataUrl, regenerateAscii]);

  return (
    <section>
      <h3 
        className="font-semibold text-foreground mb-4 text-sm uppercase tracking-wide"
        style={{ fontFamily: "var(--font-pixel), var(--font-press-start), monospace", fontWeight: 600, fontSize: "1.1rem", letterSpacing: "0.05em" }}
      >
        1. Upload Your File
      </h3>
      <div className="space-y-3">
        <div>
          <Label className="text-xs text-muted-foreground mb-2 block">
            Image:
          </Label>
          <Input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files?.[0] || null)}
            className="bg-input border-border text-foreground text-xs cursor-pointer file:hover:bg-accent file:transition-colors file:duration-200 hover:border-primary/50 transition-colors"
          />
          {imageFile && (
            <div className="mt-2 space-y-2">
              <p className="text-xs text-muted-foreground">{imageFile.name}</p>
              {previewUrl && (
                <Image
                  width={100}
                  height={100}
                  src={previewUrl}
                  alt="Preview"
                  className="w-full rounded border border-border object-contain max-h-32"
                />
              )}
              <Button
                onClick={() => {
                  setImageFile(null);
                  setAsciiOutput(""); // Clear ASCII output from canvas
                }}
                className="w-full bg-zinc-900 dark:bg-zinc-800 text-white hover:bg-zinc-800 dark:hover:bg-zinc-700 font-bold text-xs uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer px-6 py-3 rounded-sm border-0"
                style={{ fontFamily: "var(--font-pixel), var(--font-press-start), monospace", fontWeight: 600, letterSpacing: "0.05em" }}
              >
                <span className="flex items-center gap-2">
                  <TrashIcon className="size-4" />
                  Remove Image
                </span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
