# WASM ASCII Converter

Rust WebAssembly implementation of ASCII art conversion algorithms for high-performance image processing.

## Building

```bash
# Development build (faster, larger)
wasm-pack build --target web --out-dir pkg --dev

# Production build (optimized, smaller)
wasm-pack build --target web --out-dir pkg
```

## Features

- **Grayscale Conversion**: RGB to luminance conversion
- **Brightness/Contrast Adjustment**: Per-pixel adjustments
- **Edge Detection**: Sobel and Difference of Gaussians (DoG)
- **Dithering**: Floyd-Steinberg, Atkinson, Noise, Ordered (Bayer)
- **ASCII Mapping**: Character set mapping with configurable levels

## Performance

- **2-10x faster** than JavaScript for large images
- **Memory efficient**: Optimized data structures
- **Parallelizable**: Can be used in Web Workers

## Usage

See `WASM_MIGRATION_GUIDE.md` in the project root for integration instructions.

## Dependencies

- `wasm-bindgen`: JavaScript bindings
- `js-sys`: JavaScript standard library bindings (optional, for future RNG)

## Future Improvements

- [ ] Add proper random number generation for noise dithering
- [ ] SIMD optimizations for convolution operations
- [ ] Web Worker support for non-blocking processing
- [ ] Multi-threading with `wasm-bindgen-rayon`
