"use client";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useCallback, useRef } from "react";
import { useAsciiStore } from "../../store/ascii-store";
import { generateAsciiFromText } from "../../utils/ascii-converter";

export const GenerateTextSection = () => {
  const {
    inputText,
    setInputText,
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

  // Real-time regeneration function - updates immediately on settings change
  const regenerateAscii = useCallback(() => {
    generateAsciiFromText(inputText, {
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
    inputText,
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
  }, [regenerateAscii]);
  return (
    <section>
      <h3 
        className="font-semibold text-foreground mb-4 text-sm uppercase tracking-wide"
        style={{ fontFamily: "var(--font-pixel), var(--font-press-start), monospace", fontWeight: 600, fontSize: "1.1rem", letterSpacing: "0.05em" }}
      >
        2. Generate from Text
      </h3>
      <div className="space-y-3">
        <div>
          <Label
            htmlFor="textInput"
            className="text-xs text-muted-foreground mb-2 block"
          >
            Text:
          </Label>
          <Textarea
            id="textInput"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type something..."
            className="min-h-20 bg-input border-border text-foreground text-xs"
          />
        </div>
      </div>
    </section>
  );
};
