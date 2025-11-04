"use client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAsciiStore } from "../../store/ascii-store";

const GenerateTextSection = () => {
  const { inputText, setInputText } = useAsciiStore();

  const generateFromText = () => {
    console.log("Generating from text...");
  };
  return (
    <section className="bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/30 rounded-lg p-4">
      <h3 className="font-semibold text-foreground mb-4 text-sm uppercase tracking-wide">
        2. Generate from Text
      </h3>
      <div className="space-y-3">
        <div>
          <Label
            htmlFor="textInput"
            className="text-xs text-muted-foreground mb-2 block"
          >
            Text to Convert:
          </Label>
          <Textarea
            id="textInput"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Enter text..."
            className="min-h-20 bg-input border-border text-foreground placeholder-muted-foreground text-sm"
          />
        </div>
        <Button
          onClick={generateFromText}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
        >
          ✨ Generate from Text
        </Button>
      </div>
    </section>
  );
};
export default GenerateTextSection;
