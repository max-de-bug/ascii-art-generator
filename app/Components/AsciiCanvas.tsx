"use client";
import { useMemo, memo, useRef, useEffect } from "react";
import { useSphereAnimation } from "./hooks/useSphereAnimation";

interface AsciiCanvasProps {
  asciiOutput: string;
  zoom: number[];
  hasSource?: boolean; // Whether an image or text source is loaded
}

// Memoized canvas component to prevent unnecessary rerenders
export const AsciiCanvas = memo(({ asciiOutput, zoom, hasSource = false }: AsciiCanvasProps) => {
  const fontSize = useMemo(() => `${(zoom[0] / 100) * 12}px`, [zoom]);
  
  // Keep track of the last valid ASCII output to prevent flickering during regeneration
  const lastOutputRef = useRef<string>("");
  
  // Update the ref when we have valid output
  useEffect(() => {
    if (asciiOutput) {
      lastOutputRef.current = asciiOutput;
    }
  }, [asciiOutput]);
  
  // Use the current output, or fall back to last output if source is still loaded (regenerating)
  const displayOutput = asciiOutput || (hasSource ? lastOutputRef.current : "");
  
  // Only show animation when there's no source loaded and no output
  const showAnimation = !hasSource && !displayOutput;
  const { frame: sphereFrame, textFrame, isInitialized } = useSphereAnimation(showAnimation, "O.ASCII Art generator");
  
  return (
    <div className="aspect-square bg-card border border-border rounded-lg overflow-hidden flex items-center justify-center">
      <div className="overflow-auto w-full h-full p-8 flex items-center justify-center">
        <pre
          className="font-mono text-foreground leading-tight whitespace-pre select-all text-center"
          style={{
            fontSize,
            fontFamily: '"Geist Mono", monospace',
            fontWeight: 600,
            letterSpacing: "-0.5px",
            lineHeight: "1.1",
          }}
        >
          {displayOutput ? (
            <code>{displayOutput}</code>
          ) : isInitialized && sphereFrame ? (
            <code>
              {sphereFrame}
              <br />
              <br />
              {textFrame}
            </code>
          ) : (
            <span className="text-muted-foreground/40">
              Generate ASCII art
            </span>
          )}
        </pre>
      </div>
    </div>
  );
});

AsciiCanvas.displayName = "AsciiCanvas";

