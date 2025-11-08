# WASM Integration Example

## Step 1: Build WASM Module

```bash
# Install Rust and wasm-pack first (see WASM_MIGRATION_GUIDE.md)
npm run build:wasm
```

This will create `wasm-ascii/pkg/` with the compiled WASM module.

## Step 2: Initialize WASM in Your App

In your main app file (e.g., `app/layout.tsx` or `app/page.tsx`):

```typescript
import { initWasm } from "./components/utils/ascii-converter-wasm";

// Initialize WASM on app load
if (typeof window !== "undefined") {
  initWasm().catch(console.error);
}
```

## Step 3: Update Components to Use WASM

### Option A: Replace Entire Module (Recommended for testing)

In `app/components/Sidebar/sections/GenerateTextSection.tsx`:

```typescript
// Change this:
import { generateAsciiFromText } from "../../utils/ascii-converter";

// To this:
import { generateAsciiFromTextWasm as generateAsciiFromText } from "../../utils/ascii-converter-wasm";
```

### Option B: Gradual Migration (Recommended for production)

Create a feature flag:

```typescript
const USE_WASM = process.env.NEXT_PUBLIC_USE_WASM === "true";

const generateAscii = USE_WASM
  ? generateAsciiFromTextWasm
  : generateAsciiFromText;
```

## Step 4: Handle Async Operations

Since WASM initialization is async, update your components:

```typescript
// Before (synchronous):
const regenerateAscii = useCallback(() => {
  generateAsciiFromText(inputText, options);
}, [inputText, ...]);

// After (async):
const regenerateAscii = useCallback(async () => {
  await generateAsciiFromTextWasm(inputText, options);
}, [inputText, ...]);
```

## Step 5: Performance Testing

Compare performance:

```typescript
// Measure TypeScript version
console.time("TS Conversion");
generateAsciiFromText(text, options);
console.timeEnd("TS Conversion");

// Measure WASM version
console.time("WASM Conversion");
await generateAsciiFromTextWasm(text, options);
console.timeEnd("WASM Conversion");
```

## Troubleshooting

### WASM module not found

- Ensure `npm run build:wasm` completed successfully
- Check that `wasm-ascii/pkg/` exists
- Verify import path is correct

### Initialization errors

- Check browser console for WASM loading errors
- Ensure WASM is initialized before use
- Try using the async version (`convertCanvasToAsciiWasm`)

### Performance not improved

- WASM overhead is significant for small images (< 100x100)
- Consider using WASM only for images above a certain size
- Check that you're using the production build (`npm run build:wasm`)

## Next Steps

1. **Web Workers**: Move WASM processing to a Web Worker for non-blocking UI
2. **SIMD**: Enable SIMD optimizations for even better performance
3. **Progressive Enhancement**: Fall back to TypeScript if WASM fails to load
