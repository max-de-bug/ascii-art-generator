"use client";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAsciiStore } from "../../store/ascii-store";

export const EdgeDetection = () => {
  const {
    edgeMethod,
    edgeThreshold,
    dogThreshold,
    setEdgeMethod,
    setEdgeThreshold,
    setDogThreshold,
  } = useAsciiStore();

  return (
    <section>
      <h3 
        className="font-semibold text-foreground mb-4 text-sm uppercase tracking-wide hover:[text-shadow:0_0_10px_currentColor,0_0_20px_currentColor] transition-all duration-300 cursor-pointer"
        style={{ fontFamily: "var(--font-pixel), var(--font-press-start), monospace", fontWeight: 600, fontSize: "1.1rem", letterSpacing: "0.05em" }}
      >
        5. Edge Detection
      </h3>
      <p className="text-xs text-muted-foreground mb-3">Select one method:</p>
      <RadioGroup
        value={edgeMethod}
        onValueChange={setEdgeMethod}
        className="space-y-2"
      >
        <div className="flex items-center gap-2">
          <RadioGroupItem value="none" id="edgeNone" />
          <Label
            htmlFor="edgeNone"
            className={`text-xs cursor-pointer transition-colors duration-300 hover:text-white ${
              edgeMethod === "none" ? "text-white" : "text-muted-foreground"
            }`}
          >
            No Edge Detection
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="sobel" id="edgeSobel" />
          <Label
            htmlFor="edgeSobel"
            className={`text-xs cursor-pointer transition-colors duration-300 hover:text-white ${
              edgeMethod === "sobel" ? "text-white" : "text-muted-foreground"
            }`}
          >
            Sobel Edge Detection
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="dog" id="edgeDoG" />
          <Label
            htmlFor="edgeDoG"
            className={`text-xs cursor-pointer transition-colors duration-300 hover:text-white ${
              edgeMethod === "dog" ? "text-white" : "text-muted-foreground"
            }`}
          >
            DoG (Contour) Detection
          </Label>
        </div>
        {edgeMethod === "sobel" && (
          <div className="mt-3 ml-4">
            <div className="flex justify-between items-center mb-2">
              <Label className="text-xs text-muted-foreground">
                Sobel Threshold:
              </Label>
              <span className="text-sm text-accent font-semibold">
                {edgeThreshold[0]}
              </span>
            </div>
            <Slider
              value={edgeThreshold}
              onValueChange={setEdgeThreshold}
              min={0}
              max={255}
              step={1}
            />
          </div>
        )}
        {edgeMethod === "dog" && (
          <div className="mt-3 ml-4">
            <div className="flex justify-between items-center mb-2">
              <Label className="text-xs text-muted-foreground">
                DoG Threshold:
              </Label>
              <span className="text-sm text-accent font-semibold">
                {dogThreshold[0]}
              </span>
            </div>
            <Slider
              value={dogThreshold}
              onValueChange={setDogThreshold}
              min={0}
              max={255}
              step={1}
            />
          </div>
        )}
      </RadioGroup>
    </section>
  );
};
