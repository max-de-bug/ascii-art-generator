"use client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAsciiStore, ASCII_CHARS } from "../../store/ascii-store";

export const CharacterSet = () => {
  const { charset, manualChar, setCharset, setManualChar } = useAsciiStore();

  return (
    <section>
      <h3 
        className="font-semibold text-foreground mb-4 text-sm uppercase tracking-wide"
        style={{ fontFamily: "var(--font-pixel), var(--font-press-start), monospace", fontWeight: 600, fontSize: "1.1rem", letterSpacing: "0.05em" }}
      >
        4. Character Set
      </h3>
      <div className="space-y-3">
        <div>
          <Label
            htmlFor="charset"
            className="text-xs text-muted-foreground mb-2 block"
          >
            Select Set:
          </Label>
          <Select
            value={charset}
            onValueChange={(value) =>
              setCharset(value as keyof typeof ASCII_CHARS)
            }
          >
            <SelectTrigger className="w-full px-3 py-2 bg-input border border-border text-foreground rounded-md text-sm">
              <SelectValue placeholder="Select charset" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="detailed">Detailed</SelectItem>
              <SelectItem value="standard">Standard</SelectItem>
              <SelectItem value="blocks">Blocks</SelectItem>
              <SelectItem value="binary">Binary</SelectItem>
              <SelectItem value="hex">Hex</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {charset === "manual" && (
          <div>
            <Label
              htmlFor="manualChar"
              className="text-xs text-muted-foreground mb-2 block"
            >
              Manual Character:
            </Label>
            <Input
              id="manualChar"
              type="text"
              maxLength={1}
              value={manualChar}
              onChange={(e) => setManualChar(e.target.value || "0")}
              className="bg-input border-border text-foreground text-center"
            />
          </div>
        )}
      </div>
    </section>
  );
};
