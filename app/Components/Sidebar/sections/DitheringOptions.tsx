"use client";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAsciiStore } from "../../store/ascii-store";

export const DitheringOptions = () => {
  const { dithering, ditherAlgorithm, setDithering, setDitherAlgorithm } =
    useAsciiStore();

  return (
    <section>
      <h3 className="font-semibold text-foreground mb-4 text-sm uppercase tracking-wide">
        3. Dithering Options
      </h3>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="dithering"
            checked={dithering}
            onCheckedChange={(checked) => setDithering(checked === true)}
          />
          <Label
            htmlFor="dithering"
            className="text-xs text-muted-foreground cursor-pointer"
          >
            Enable Dithering
          </Label>
        </div>
        <div>
          <Label
            htmlFor="ditherAlgorithm"
            className="text-xs text-muted-foreground mb-2 block"
          >
            Dither Algorithm:
          </Label>
          <Select value={ditherAlgorithm} onValueChange={setDitherAlgorithm}>
            <SelectTrigger
              id="ditherAlgorithm"
              className="w-full px-3 py-2 bg-input border border-border text-foreground rounded-md text-sm"
            >
              <SelectValue placeholder="Select algorithm" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="floyd">Floyd–Steinberg</SelectItem>
              <SelectItem value="atkinson">Atkinson</SelectItem>
              <SelectItem value="noise">Noise</SelectItem>
              <SelectItem value="ordered">Ordered</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </section>
  );
};
