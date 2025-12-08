/* tslint:disable */
/* eslint-disable */
/**
 * Generate ASCII art text centered in a grid
 */
export function generate_text_in_center(text: string, width: number, height: number): string;
/**
 * Generate a single frame of the animated organic circle
 * Returns the ASCII art string for the current frame
 */
export function generate_sphere_frame(angle: number): string;
/**
 * Get image dimensions without decoding the full image
 */
export function get_image_dimensions(image_data: Uint8Array): Uint32Array;
/**
 * Compress and optimize an image optimized for ASCII art
 * 
 * ASCII art (text on solid backgrounds) compresses extremely well with aggressive settings:
 * - Aggressive quality reduction (50-75% range) - text is very forgiving
 * - Automatic quality adjustment based on image size
 * - Smart format selection (JPEG preferred for ASCII art)
 * - Safety checks to avoid making files larger
 * 
 * Optimization strategy:
 * - Small images (< 50KB): Very aggressive compression (50-65% quality)
 * - Medium images (50-200KB): Moderate compression (60-70% quality)
 * - Large images (> 200KB): Standard compression (65-75% quality)
 * - Returns original if compression would make file larger
 * 
 * # Arguments
 * * `image_data` - Raw image bytes (PNG, JPEG, etc.)
 * * `max_width` - Maximum width in pixels (maintains aspect ratio)
 * * `quality` - JPEG quality 0-100 (only used for JPEG output)
 * * `format` - Output format: "jpeg" or "png"
 * 
 * # Returns
 * Compressed image bytes
 */
export function compress_image(image_data: Uint8Array, max_width: number, quality: number, format: string): Uint8Array;
export function convert_to_ascii(data: Uint8Array, width: number, height: number, invert: boolean, charset: string, manual_char: string, ignore_white: boolean, dithering: boolean, dither_algorithm: string, edge_method: string, edge_threshold: number, dog_threshold: number, brightness: number, contrast: number): string;
/**
 * Chroma subsampling format
 */
export enum ChromaSampling {
  /**
   * Both vertically and horizontally subsampled.
   */
  Cs420 = 0,
  /**
   * Horizontally subsampled.
   */
  Cs422 = 1,
  /**
   * Not subsampled.
   */
  Cs444 = 2,
  /**
   * Monochrome.
   */
  Cs400 = 3,
}
/**
 * Image output format
 */
export enum ImageFormatType {
  /**
   * JPEG format (better compression for ASCII art)
   */
  Jpeg = 0,
  /**
   * PNG format (lossless, but larger for ASCII art)
   */
  Png = 1,
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly compress_image: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
  readonly convert_to_ascii: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number, p: number, q: number, r: number, s: number, t: number) => void;
  readonly generate_sphere_frame: (a: number, b: number) => void;
  readonly generate_text_in_center: (a: number, b: number, c: number, d: number, e: number) => void;
  readonly get_image_dimensions: (a: number, b: number, c: number) => void;
  readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
  readonly __wbindgen_export: (a: number, b: number) => number;
  readonly __wbindgen_export2: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_export3: (a: number, b: number, c: number) => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
