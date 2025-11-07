"use client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAsciiStore } from "../../store/ascii-store";
import {
  convertCanvasToAscii,
  createCanvasFromText,
} from "../../utils/ascii-converter";

const GenerateTextSection = () => {
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

  const generateFromText = () => {
    if (!inputText.trim()) return;

    const width = Math.floor(asciiWidth[0]);
    const canvas = createCanvasFromText(inputText, width, blur);

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
  return (
    <section>
      <h3 className="font-semibold text-foreground mb-4 text-sm uppercase tracking-wide">
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
        <Button
          onClick={generateFromText}
          disabled={!inputText.trim()}
          className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
        >
          Generate
        </Button>
      </div>
    </section>
  );
};
export default GenerateTextSection;
