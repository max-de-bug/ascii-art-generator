"use client";
import { Button } from "@/components/ui/button";
import { useAsciiStore } from "../../store/ascii-store";

export const ResetButton = () => {
  const { resetAllSettings } = useAsciiStore();

  return (
    <section>
      <Button
        onClick={resetAllSettings}
        className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground"
      >
        Reset All Settings
      </Button>
    </section>
  );
};
