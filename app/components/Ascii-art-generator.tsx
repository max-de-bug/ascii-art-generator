"use client";
import { useAsciiStore } from "./store/ascii-store";
import { AsciiActions } from "./AsciiActions";
import { Button } from "@/components/ui/button";
import { MintButton } from "./MintButton";

const AsciiGenerator = () => {
  const { asciiOutput, zoom } = useAsciiStore();

  return (
    <main className="flex-1 overflow-y-auto p-6 bg-background flex justify-center">
      <div className="w-full max-w-3xl flex flex-col">
        <div className="flex flex-col gap-8">
          <AsciiActions asciiOutput={asciiOutput} />
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">
              ASCII Art
            </h1>
            <p className="text-muted-foreground text-sm">
              Your generated artwork
            </p>
          </div>
          <div className="aspect-square bg-card border border-border rounded-lg overflow-hidden flex items-center justify-center">
            <div className="overflow-auto w-full h-full p-8 flex items-center justify-center">
              <pre
                className="font-mono text-foreground leading-tight whitespace-pre select-all text-center"
                style={{
                  fontSize: `${(zoom[0] / 100) * 12}px`,
                  fontFamily: '"Geist Mono", monospace',
                  fontWeight: 600,
                  letterSpacing: "-0.5px",
                  lineHeight: "1.1",
                }}
              >
                {asciiOutput ? (
                  <code>{asciiOutput}</code>
                ) : (
                  <span className="text-muted-foreground/40">
                    Generate ASCII art
                  </span>
                )}
              </pre>
            </div>
          </div>
        </div>
        <MintButton />
      </div>
    </main>
  );
};

export default AsciiGenerator;
