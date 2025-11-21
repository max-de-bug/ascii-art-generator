"use client";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useAsciiStore } from "../../store/ascii-store";

export const DisplaySettings = () => {
  const { zoom, setZoom } = useAsciiStore();

  return (
    <section>
      <h3 
        className="font-semibold text-foreground mb-4 text-sm uppercase tracking-wide"
        style={{ fontFamily: "var(--font-pixel), var(--font-press-start), monospace", fontWeight: 600, fontSize: "1.1rem", letterSpacing: "0.05em" }}
      >
        6. Display Settings
      </h3>
      <div>
        <div className="flex justify-between items-center mb-2">
          <Label className="text-xs text-muted-foreground">Zoom (%):</Label>
          <span className="text-sm text-accent font-semibold">{zoom[0]}</span>
        </div>
        <Slider
          value={zoom}
          onValueChange={setZoom}
          min={20}
          max={600}
          step={10}
        />
      </div>
    </section>
  );
};
