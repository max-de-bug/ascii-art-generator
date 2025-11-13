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
      <h3 className="font-semibold text-foreground mb-4 text-sm uppercase tracking-wide">
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
            className="text-xs text-muted-foreground cursor-pointer"
          >
            No Edge Detection
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="sobel" id="edgeSobel" />
          <Label
            htmlFor="edgeSobel"
            className="text-xs text-muted-foreground cursor-pointer"
          >
            Sobel Edge Detection
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="dog" id="edgeDoG" />
          <Label
            htmlFor="edgeDoG"
            className="text-xs text-muted-foreground cursor-pointer"
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
