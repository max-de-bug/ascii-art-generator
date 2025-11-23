"use client";

declare module "../../../wasm-ascii/pkg/wasm_ascii" {
    export function compress_image(
      image_data: Uint8Array,
      max_width: number,
      quality: number,
      format: string
    ): Uint8Array;
  
    export function get_image_dimensions(
      image_data: Uint8Array
    ): number[];
  
    export default function init(input?: RequestInfo | URL): Promise<void>;
  }
  
  /**
   * Load and initialize WASM module for image compression
   */
  let wasmModule: any = null;
  let wasmInitialized = false;
  
  export async function loadWasmModule() {
    if (wasmInitialized && wasmModule) {
      return wasmModule;
    }
  
    try {
      const wasm = await import("../../../wasm-ascii/pkg/wasm_ascii");
      await wasm.default();
      wasmModule = wasm;
      wasmInitialized = true;
      return wasm;
    } catch (error) {
      console.warn("WASM compression not available, falling back to JS optimization:", error);
      return null;
    }
  }
  