"use client";

import { useEffect, useRef, useState } from "react";

// Type declarations for WASM module
declare module "../../../wasm-ascii/pkg/wasm_ascii" {
  export function generate_sphere_frame(angle: number): string;
  export function generate_text_in_center(text: string, width: number, height: number): string;
  export default function init(input?: RequestInfo | URL): Promise<void>;
}

let wasmModule: { 
  generate_sphere_frame: (angle: number) => string;
  generate_text_in_center: (text: string, width: number, height: number) => string;
} | null = null;
let wasmInitialized = false;

const initWasm = async (): Promise<void> => {
  if (!wasmInitialized && typeof window !== "undefined") {
    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - TypeScript can't resolve this module until it's built
      const wasm = await import("../../../wasm-ascii/pkg/wasm_ascii");
      await wasm.default();
      wasmModule = wasm as { 
        generate_sphere_frame: (angle: number) => string;
        generate_text_in_center: (text: string, width: number, height: number) => string;
      };
      wasmInitialized = true;
    } catch (error) {
      console.error("Failed to initialize WASM module for sphere animation:", error);
      wasmInitialized = false;
    }
  }
};

/**
 * React hook for animated sphere ASCII art
 * Returns the current frame of the animation and text below it
 */
export const useSphereAnimation = (enabled: boolean = true, text: string = "Generate ASCII art") => {
  const [frame, setFrame] = useState<string>("");
  const [textFrame, setTextFrame] = useState<string>("");
  const [isInitialized, setIsInitialized] = useState(false);
  const angleRef = useRef(0.0);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      setFrame("");
      setTextFrame("");
      return;
    }

    // Initialize WASM
    const initialize = async () => {
      if (!wasmInitialized) {
        await initWasm();
      }
      const initialized = wasmInitialized && wasmModule !== null;
      setIsInitialized(initialized);
      
      // Generate text frame when initialized or text changes
      if (initialized && wasmModule) {
        const textAscii = wasmModule.generate_text_in_center(text, 40, 5);
        setTextFrame(textAscii);
      }
    };

    initialize();

    // Animation loop
    const animate = (currentTime: number) => {
      // Throttle to ~20 FPS (50ms per frame, matching original C code)
      if (currentTime - lastTimeRef.current >= 50) {
        if (wasmModule && wasmInitialized) {
          const newFrame = wasmModule.generate_sphere_frame(angleRef.current);
          setFrame(newFrame);
          angleRef.current += 0.1;
          if (angleRef.current >= 2 * Math.PI) {
            angleRef.current -= 2 * Math.PI;
          }
        }
        lastTimeRef.current = currentTime;
      }
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [enabled, text]);

  return { frame, textFrame, isInitialized };
};

