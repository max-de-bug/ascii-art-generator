"use client";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { TrashIcon } from "lucide-react";
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
        className="font-semibold text-foreground mb-4 text-sm uppercase tracking-wide hover:[text-shadow:0_0_10px_currentColor,0_0_20px_currentColor] transition-all duration-300 cursor-pointer"
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
          {inputText && (
            <div className="mt-2">
              <Button
                onClick={() => setInputText("")}
                className="w-full bg-zinc-900 dark:bg-zinc-800 text-white hover:bg-zinc-800 dark:hover:bg-zinc-700 font-bold text-xs uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer px-6 py-3 rounded-sm border-0"
                style={{ fontFamily: "var(--font-pixel), var(--font-press-start), monospace", fontWeight: 600, letterSpacing: "0.05em" }}
              >
                <span className="flex items-center gap-2">
                  <TrashIcon className="size-4" />
                  Remove Text
                </span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
