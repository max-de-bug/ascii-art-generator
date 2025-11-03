import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { useAsciiStore } from "../../store/ascii-store";

export const BasicAdjustments = () => {
  const {
    asciiWidth,
    brightness,
    contrast,
    blur,
    invert,
    setAsciiWidth,
    setBrightness,
    setContrast,
    setBlur,
    setInvert,
  } = useAsciiStore();

  return (
    <section>
      <h3 className="font-semibold text-foreground mb-4 text-sm uppercase tracking-wide">
        2. Basic Adjustments
      </h3>
      <div className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-2">
            <Label className="text-xs text-muted-foreground">
              Output Width (chars):
            </Label>
            <span className="text-sm text-accent font-semibold">
              {asciiWidth[0]}
            </span>
          </div>
          <Slider
            value={asciiWidth}
            onValueChange={setAsciiWidth}
            min={20}
            max={300}
            step={1}
          />
        </div>
        <div>
          <div className="flex justify-between items-center mb-2">
            <Label className="text-xs text-muted-foreground">Brightness:</Label>
            <span className="text-sm text-accent font-semibold">
              {brightness[0]}
            </span>
          </div>
          <Slider
            value={brightness}
            onValueChange={setBrightness}
            min={-100}
            max={100}
            step={1}
          />
        </div>
        <div>
          <div className="flex justify-between items-center mb-2">
            <Label className="text-xs text-muted-foreground">Contrast:</Label>
            <span className="text-sm text-accent font-semibold">
              {contrast[0]}
            </span>
          </div>
          <Slider
            value={contrast}
            onValueChange={setContrast}
            min={-100}
            max={100}
            step={1}
          />
        </div>
        <div>
          <div className="flex justify-between items-center mb-2">
            <Label className="text-xs text-muted-foreground">Blur (px):</Label>
            <span className="text-sm text-accent font-semibold">
              {blur[0].toFixed(2)}
            </span>
          </div>
          <Slider
            value={blur}
            onValueChange={setBlur}
            min={0}
            max={10}
            step={0.1}
          />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="invert"
            checked={invert}
            onCheckedChange={(checked) => setInvert(checked === true)}
          />
          <Label
            htmlFor="invert"
            className="text-xs text-muted-foreground cursor-pointer"
          >
            Invert Colors
          </Label>
        </div>
      </div>
    </section>
  );
};
