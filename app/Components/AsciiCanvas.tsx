"use client";
import { useMemo, memo } from "react";
import { useSphereAnimation } from "./hooks/useSphereAnimation";

interface AsciiCanvasProps {
  asciiOutput: string;
  zoom: number[];
}

// Memoized canvas component to prevent unnecessary rerenders
export const AsciiCanvas = memo(({ asciiOutput, zoom }: AsciiCanvasProps) => {
  const fontSize = useMemo(() => `${(zoom[0] / 100) * 12}px`, [zoom]);
  const showAnimation = !asciiOutput;
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
          {asciiOutput ? (
            <code>{asciiOutput}</code>
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

