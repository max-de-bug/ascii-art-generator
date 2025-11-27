import { create } from "zustand";

export const ASCII_CHARS = {
  detailed: "░▒▓█",
  standard: " .:-=+*#%@",
  blocks: "██",
  binary: "01",
  hex: "0123456789ABCDEF",
  manual: "0123456789ABCDEF",
} as const;

// Initial state - extracted for reusability and maintainability
const initialState = {
  inputText: "",
  imageFile: null as File | null,
  asciiOutput: "",
  theme: "dark",
  ignoreWhite: true,
  asciiWidth: [100] as number[],
  brightness: [0] as number[],
  contrast: [0] as number[],
  blur: [0] as number[],
  invert: false,
  dithering: true,
  ditherAlgorithm: "floyd",
  charset: "detailed" as keyof typeof ASCII_CHARS,
  manualChar: "0",
  edgeMethod: "none",
  edgeThreshold: [100] as number[],
  dogThreshold: [100] as number[],
  zoom: [100] as number[],
};

interface AsciiState {
  // Input state
  inputText: string;
  imageFile: File | null;
  asciiOutput: string;

  // Theme
  theme: string;

  // Global settings
  ignoreWhite: boolean;

  // Basic adjustments
  asciiWidth: number[];
  brightness: number[];
  contrast: number[];
  blur: number[];
  invert: boolean;

  // Dithering
  dithering: boolean;
  ditherAlgorithm: string;

  // Character set
  charset: keyof typeof ASCII_CHARS;
  manualChar: string;

  // Edge detection
  edgeMethod: string;
  edgeThreshold: number[];
  dogThreshold: number[];

  // Display
  zoom: number[];

  // Actions
  setInputText: (text: string) => void;
  setImageFile: (file: File | null) => void;
  setAsciiOutput: (output: string) => void;
  setTheme: (theme: string) => void;
  setIgnoreWhite: (value: boolean) => void;
  setAsciiWidth: (value: number[]) => void;
  setBrightness: (value: number[]) => void;
  setContrast: (value: number[]) => void;
  setBlur: (value: number[]) => void;
  setInvert: (value: boolean) => void;
  setDithering: (value: boolean) => void;
  setDitherAlgorithm: (algorithm: string) => void;
  setCharset: (charset: keyof typeof ASCII_CHARS) => void;
  setManualChar: (char: string) => void;
  setEdgeMethod: (method: string) => void;
  setEdgeThreshold: (threshold: number[]) => void;
  setDogThreshold: (threshold: number[]) => void;
  setZoom: (zoom: number[]) => void;
  resetAllSettings: () => void;
}

export const useAsciiStore = create<AsciiState>((set) => ({
  // Initial state
  ...initialState,

  // Actions - grouped logically
  // Input actions
  setInputText: (text) => set({ inputText: text }),
  setImageFile: (file) => set({ imageFile: file }),
  setAsciiOutput: (output) => set({ asciiOutput: output }),

  // Theme action
  setTheme: (theme) => set({ theme }),

  // Global settings
  setIgnoreWhite: (value) => set({ ignoreWhite: value }),

  // Basic adjustments
  setAsciiWidth: (value) => set({ asciiWidth: value }),
  setBrightness: (value) => set({ brightness: value }),
  setContrast: (value) => set({ contrast: value }),
  setBlur: (value) => set({ blur: value }),
  setInvert: (value) => set({ invert: value }),

  // Dithering
  setDithering: (value) => set({ dithering: value }),
  setDitherAlgorithm: (algorithm) => set({ ditherAlgorithm: algorithm }),

  // Character set
  setCharset: (charset) => set({ charset }),
  setManualChar: (char) => set({ manualChar: char }),

  // Edge detection
  setEdgeMethod: (method) => set({ edgeMethod: method }),
  setEdgeThreshold: (threshold) => set({ edgeThreshold: threshold }),
  setDogThreshold: (threshold) => set({ dogThreshold: threshold }),

  // Display
  setZoom: (zoom) => set({ zoom }),

  // Reset - uses initial state to avoid duplication
  resetAllSettings: () => set(initialState),
}));
