"use client";
import { Input } from "@/components/ui/input";
import { useRef, useState, useEffect } from "react";
import { useAsciiStore } from "../../store/ascii-store";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import {
  convertCanvasToAscii,
  createCanvasFromImage,
} from "../../utils/ascii-converter";
export const UploadImageSection = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
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

  useEffect(() => {
    if (imageFile) {
      const url = URL.createObjectURL(imageFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
      // Clear the file input when imageFile is reset
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [imageFile]);

  const generateFromImage = async () => {
    if (!imageFile) return;

    const reader = new FileReader();
    reader.onload = async (e: ProgressEvent<FileReader>) => {
      const img = document.createElement("img");
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const width = Math.floor(asciiWidth[0]);
        const canvas = createCanvasFromImage(img, width, blur);

        const ascii = convertCanvasToAscii({
          canvas,
          width,
          invert,
          charset,
          manualChar,
          ignoreWhite,
          dithering,
          ditherAlgorithm,
          edgeMethod,
          edgeThreshold,
          dogThreshold,
          brightness,
          contrast,
        });

        setAsciiOutput(ascii);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(imageFile);
  };

  return (
    <section>
      <h3 className="font-semibold text-foreground mb-4 text-sm uppercase tracking-wide">
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
            className="bg-input border-border text-foreground text-xs"
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
            </div>
          )}
        </div>
        <Button
          onClick={generateFromImage}
          disabled={!imageFile}
          className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
        >
          Generate
        </Button>
      </div>
    </section>
  );
};
