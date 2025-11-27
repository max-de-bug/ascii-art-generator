"use client";
import { Button } from "@/components/ui/button";
import { useAsciiStore } from "../../store/ascii-store";

export const ResetButton = () => {
  const { resetAllSettings } = useAsciiStore();

  return (
    <section>
      <Button
        onClick={resetAllSettings}
        className="w-full bg-zinc-900 dark:bg-zinc-800 text-white hover:bg-zinc-800 dark:hover:bg-zinc-700 font-bold text-xs uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer px-6 py-3 rounded-sm border-0"
        style={{ fontFamily: "var(--font-pixel), var(--font-press-start), monospace", fontWeight: 600, letterSpacing: "0.05em" }}
      >
        Reset All Settings
      </Button>
    </section>
  );
};
