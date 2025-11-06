"use client";
import { Input } from "@/components/ui/input";
import { useRef, useState, useEffect } from "react";
import { useAsciiStore } from "../../store/ascii-store";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ASCII_CHARS } from "../../store/ascii-store";
import Image from "next/image";
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
    setAsciiOutput,
    asciiOutput,
  } = useAsciiStore();

  useEffect(() => {
    if (imageFile) {
      const url = URL.createObjectURL(imageFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [imageFile]);

  const generateFromImage = async () => {
    if (!imageFile) return;

    const reader = new FileReader();
    reader.onload = async (e: ProgressEvent<FileReader>) => {
      const img = document.createElement("img");
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const width = Math.floor(asciiWidth[0]);
        const height = Math.floor((img.height / img.width) * width * 0.55);

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.filter = `brightness(${100 + brightness[0]}%) contrast(${
          100 + contrast[0]
        }%) blur(${blur[0]}px)`;
        ctx.drawImage(img, 0, 0, width, height);

        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        if (invert) {
          for (let i = 0; i < data.length; i += 4) {
            data[i] = 255 - data[i];
            data[i + 1] = 255 - data[i + 1];
            data[i + 2] = 255 - data[i + 2];
          }
        }

        let ascii = "";
        const chars = charset === "manual" ? manualChar : ASCII_CHARS[charset];
        const charArray = chars.split("");

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          if (ignoreWhite && r === 255 && g === 255 && b === 255) {
            ascii += " ";
          } else {
            const brightness = (r + g + b) / 3 / 255;
            const charIndex = Math.floor(brightness * (charArray.length - 1));
            ascii += charArray[charIndex];
          }

          if ((i / 4 + 1) % width === 0) {
            ascii += "\n";
          }
        }

        setAsciiOutput(ascii);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(imageFile);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(asciiOutput);
  };

  const downloadAsFile = () => {
    const element = document.createElement("a");
    element.setAttribute(
      "href",
      "data:text/plain;charset=utf-8," + encodeURIComponent(asciiOutput)
    );
    element.setAttribute("download", "ascii-art.txt");
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
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
          className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          Generate
        </Button>
      </div>
    </section>
  );
};
