import { Button } from "@/components/ui/button";
import { useAsciiStore } from "./store/ascii-store";

const AsciiGenerator = () => {
  const { asciiOutput, zoom } = useAsciiStore();

  const copyToClipboard = () => {
    if (!asciiOutput) return;
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
    <main className="flex-1 overflow-y-auto p-12 bg-background flex items-center justify-center">
      <div className="w-full max-w-3xl h-full max-h-screen flex flex-col justify-center">
        <div className="flex flex-col gap-8">
          <div className="flex gap-3 justify-center pt-6">
            <Button
              onClick={copyToClipboard}
              disabled={!asciiOutput}
              className="px-6 py-2 bg-primary hover:bg-primary/80 text-primary-foreground font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs uppercase tracking-wide"
            >
              Copy
            </Button>
            <Button
              onClick={downloadAsFile}
              disabled={!asciiOutput}
              className="px-6 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs uppercase tracking-wide"
            >
              Download
            </Button>
          </div>
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">
              ASCII Art
            </h1>
            <p className="text-muted-foreground text-sm">
              Your generaten artwork
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
      </div>
    </main>
  );
};

export default AsciiGenerator;
