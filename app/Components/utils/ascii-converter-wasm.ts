/**
 * WASM wrapper for ASCII conversion
 * This module provides a drop-in replacement for ascii-converter.ts using Rust WASM
 */

import { ASCII_CHARS } from "../store/ascii-store";

// Type declarations for WASM module are in wasm-ascii.d.ts at project root
// This module will exist after running 'npm run build:wasm'
declare module "../../../wasm-ascii/pkg/wasm_ascii" {
  export function convert_to_ascii(
    data: Uint8Array,
    width: number,
    height: number,
    invert: boolean,
    charset: string,
    manualChar: string,
    ignoreWhite: boolean,
    dithering: boolean,
    ditherAlgorithm: string,
    edgeMethod: string,
    edgeThreshold: number,
    dogThreshold: number,
    brightness: number,
    contrast: number
  ): string;

  export function generate_sphere_frame(angle: number): string;

  export default function init(input?: RequestInfo | URL): Promise<void>;
}

// Type definition for WASM module
type WasmModule = {
  convert_to_ascii: (
    data: Uint8Array,
    width: number,
    height: number,
    invert: boolean,
    charset: string,
    manualChar: string,
    ignoreWhite: boolean,
    dithering: boolean,
    ditherAlgorithm: string,
    edgeMethod: string,
    edgeThreshold: number,
    dogThreshold: number,
    brightness: number,
    contrast: number
  ) => string;
  default: () => Promise<void>;
};

// Dynamic import for WASM module (handles Next.js SSR)
let wasmModule: WasmModule | null = null;

let wasmInitialized = false;

// Initialize WASM module (call this once, e.g., in your app initialization)
export const initWasm = async (): Promise<void> => {
  if (!wasmInitialized && typeof window !== "undefined") {
    try {
      // Dynamic import for WASM (works with Next.js)
      // Module may not exist until 'npm run build:wasm' is run - handled by try/catch
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - TypeScript can't resolve this module until it's built (expected)
      const wasm = (await import(
        "../../../wasm-ascii/pkg/wasm_ascii"
      )) as WasmModule;
      await wasm.default(); // Initialize WASM module
      wasmModule = wasm;
      wasmInitialized = true;
      console.log("WASM module initialized");
    } catch (error) {
      console.error("Failed to initialize WASM module:", error);
      console.warn(
        "WASM module not found. Please run 'npm run build:wasm' to build it."
      );
      console.warn("Falling back to TypeScript implementation");
      // Don't throw - allow fallback to TypeScript version
      wasmInitialized = false; // Mark as attempted but failed
    }
  }
};

interface ConvertToAsciiOptions {
  canvas: HTMLCanvasElement;
  width: number;
  invert: boolean;
  charset: keyof typeof ASCII_CHARS;
  manualChar: string;
  ignoreWhite: boolean;
  dithering: boolean;
  ditherAlgorithm: string;
  edgeMethod: string;
  edgeThreshold: number[];
  dogThreshold: number[];
  brightness: number[];
  contrast: number[];
}

/**
 * Convert canvas to ASCII art using WASM
 * This is a drop-in replacement for the TypeScript version
 */
export const convertCanvasToAsciiWasm = async ({
  canvas,
  width,
  invert,
  charset,
  manualChar,
  ignoreWhite,
  dithering,
  ditherAlgorithm,
  edgeMethod,
  edgeThreshold,
  dogThreshold,
  brightness,
  contrast,
}: ConvertToAsciiOptions): Promise<string> => {
  // Ensure WASM is initialized
  if (!wasmInitialized) {
    await initWasm();
  }

  const height = canvas.height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return "";

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = new Uint8Array(imageData.data);

  // Get character set string
  const charsetString =
    charset === "manual" ? manualChar : ASCII_CHARS[charset];

  // Call WASM function
  if (!wasmModule) {
    throw new Error(
      "WASM module not loaded. Please run 'npm run build:wasm' and ensure initWasm() was called."
    );
  }

  const ascii = wasmModule.convert_to_ascii(
    data,
    width,
    height,
    invert,
    charsetString,
    manualChar,
    ignoreWhite,
    dithering,
    ditherAlgorithm,
    edgeMethod,
    edgeThreshold[0],
    dogThreshold[0],
    brightness[0],
    contrast[0]
  );

  return ascii;
};

/**
 * Synchronous version (requires WASM to be pre-initialized)
 * Use this if you've already called initWasm() at app startup
 */
export const convertCanvasToAsciiWasmSync = ({
  canvas,
  width,
  invert,
  charset,
  manualChar,
  ignoreWhite,
  dithering,
  ditherAlgorithm,
  edgeMethod,
  edgeThreshold,
  dogThreshold,
  brightness,
  contrast,
}: ConvertToAsciiOptions): string => {
  if (!wasmInitialized) {
    throw new Error(
      "WASM not initialized. Call initWasm() first or use convertCanvasToAsciiWasm()"
    );
  }

  const height = canvas.height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return "";

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = new Uint8Array(imageData.data);

  // Get character set string
  const charsetString =
    charset === "manual" ? manualChar : ASCII_CHARS[charset];

  // Call WASM function
  if (!wasmModule) {
    throw new Error(
      "WASM not initialized. Please run 'npm run build:wasm' and call initWasm() first, or use convertCanvasToAsciiWasm()"
    );
  }

  const ascii = wasmModule.convert_to_ascii(
    data,
    width,
    height,
    invert,
    charsetString,
    manualChar,
    ignoreWhite,
    dithering,
    ditherAlgorithm,
    edgeMethod,
    edgeThreshold[0],
    dogThreshold[0],
    brightness[0],
    contrast[0]
  );

  return ascii;
};

// Re-export canvas creation functions (these stay in TypeScript)
export {
  processCanvasWithFilters,
  getOrCreateCanvas,
  createCanvasFromImage,
  createCanvasFromText,
} from "./ascii-converter";

// Wrapper functions for generateAsciiFromImage and generateAsciiFromText
interface GenerateAsciiOptions {
  asciiWidth: number[];
  brightness: number[];
  contrast: number[];
  blur: number[];
  invert: boolean;
  charset: keyof typeof ASCII_CHARS;
  manualChar: string;
  ignoreWhite: boolean;
  dithering: boolean;
  ditherAlgorithm: string;
  edgeMethod: string;
  edgeThreshold: number[];
  dogThreshold: number[];
  setAsciiOutput: (output: string) => void;
}

export const generateAsciiFromImageWasm = async (
  imageDataUrl: string,
  options: GenerateAsciiOptions
): Promise<void> => {
  // Ensure WASM is initialized
  if (!wasmInitialized) {
    await initWasm();
  }

  // Return a Promise that resolves when the image loads and conversion completes
  return new Promise((resolve, reject) => {
    const img = document.createElement("img");
    img.crossOrigin = "anonymous";
    
    img.onload = async () => {
      try {
        const width = Math.floor(options.asciiWidth[0]);
        const { createCanvasFromImage } = await import("./ascii-converter");
        const canvas = createCanvasFromImage(img, width, options.blur);

        const ascii = convertCanvasToAsciiWasmSync({
          canvas,
          width,
          invert: options.invert,
          charset: options.charset,
          manualChar: options.manualChar,
          ignoreWhite: options.ignoreWhite,
          dithering: options.dithering,
          ditherAlgorithm: options.ditherAlgorithm,
          edgeMethod: options.edgeMethod,
          edgeThreshold: options.edgeThreshold,
          dogThreshold: options.dogThreshold,
          brightness: options.brightness,
          contrast: options.contrast,
        });

        options.setAsciiOutput(ascii);
        resolve();
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };
    
    img.src = imageDataUrl;
  });
};

export const generateAsciiFromTextWasm = async (
  text: string,
  options: GenerateAsciiOptions
): Promise<void> => {
  if (!text.trim()) {
    options.setAsciiOutput("");
    return;
  }

  // Ensure WASM is initialized
  if (!wasmInitialized) {
    await initWasm();
  }

  const width = Math.floor(options.asciiWidth[0]);
  const { createCanvasFromText } = await import("./ascii-converter");
  const canvas = createCanvasFromText(text, width, options.blur);

  const ascii = convertCanvasToAsciiWasmSync({
    canvas,
    width,
    invert: options.invert,
    charset: options.charset,
    manualChar: options.manualChar,
    ignoreWhite: options.ignoreWhite,
    dithering: options.dithering,
    ditherAlgorithm: options.ditherAlgorithm,
    edgeMethod: options.edgeMethod,
    edgeThreshold: options.edgeThreshold,
    dogThreshold: options.dogThreshold,
    brightness: options.brightness,
    contrast: options.contrast,
  });

  options.setAsciiOutput(ascii);
};
