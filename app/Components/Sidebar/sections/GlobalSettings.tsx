"use client";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAsciiStore } from "../../store/ascii-store";

export const GlobalSettings = () => {
  const { ignoreWhite, setIgnoreWhite } = useAsciiStore();

  return (
    <section>
      <h3 
        className="font-semibold text-foreground mb-4 text-sm uppercase tracking-wide"
        style={{ fontFamily: "var(--font-pixel), var(--font-press-start), monospace", fontWeight: 600, fontSize: "1.1rem", letterSpacing: "0.05em" }}
      >
        Global Settings
      </h3>
      <div className="flex items-center gap-2">
        <Checkbox
          id="ignoreWhite"
          checked={ignoreWhite}
          onCheckedChange={(checked) => setIgnoreWhite(checked === true)}
        />
        <Label
          htmlFor="ignoreWhite"
          className="text-xs text-muted-foreground cursor-pointer"
        >
          Ignore Pure White
        </Label>
      </div>
    </section>
  );
};
