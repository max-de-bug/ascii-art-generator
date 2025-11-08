# Quick Start: Rust WASM for ASCII Art

## Prerequisites

1. **Install Rust**: https://rustup.rs/
2. **Install wasm-pack**:
   ```bash
   curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
   ```

## Setup (One-time)

```bash
# 1. Build the WASM module
npm run build:wasm

# This creates: wasm-ascii/pkg/wasm_ascii.js and wasm_ascii_bg.wasm
```

## Usage

### Option 1: Initialize at App Start (Recommended)

In your main layout or page component:

```typescript
// app/layout.tsx or app/page.tsx
"use client";
import { useEffect } from "react";
import { initWasm } from "./components/utils/ascii-converter-wasm";

export default function Layout({ children }) {
  useEffect(() => {
    // Initialize WASM on mount
    initWasm().catch(console.error);
  }, []);

  return <>{children}</>;
}
```

### Option 2: Use in Components

```typescript
// Replace this:
import { generateAsciiFromText } from "../../utils/ascii-converter";

// With this:
import { generateAsciiFromTextWasm as generateAsciiFromText } from "../../utils/ascii-converter-wasm";
```

**Note**: The WASM version is async, so update your callbacks:

```typescript
// Before (sync):
const regenerateAscii = useCallback(() => {
  generateAsciiFromText(inputText, options);
}, [inputText, ...]);

// After (async):
const regenerateAscii = useCallback(async () => {
  await generateAsciiFromTextWasm(inputText, options);
}, [inputText, ...]);
```

## Build Process

```bash
# Development
npm run build:wasm:dev

# Production (optimized)
npm run build:wasm

# Full build (includes WASM)
npm run build
```

## Performance

Expected improvements:

- **Small images (50x50)**: ~1.5x faster
- **Medium images (200x200)**: ~3-5x faster
- **Large images (500x500+)**: ~5-10x faster

## Troubleshooting

### "WASM module not found"

- Run `npm run build:wasm` first
- Check that `wasm-ascii/pkg/` directory exists

### "WASM not initialized"

- Call `initWasm()` before using WASM functions
- Or use the async versions (`convertCanvasToAsciiWasm`)

### Build errors

- Ensure Rust is installed: `rustc --version`
- Ensure wasm-pack is installed: `wasm-pack --version`
- Try: `cd wasm-ascii && cargo clean && wasm-pack build --target web --out-dir pkg`

## Files Created

- `wasm-ascii/` - Rust source code
- `wasm-ascii/pkg/` - Compiled WASM (generated)
- `app/components/utils/ascii-converter-wasm.ts` - TypeScript wrapper
- `WASM_MIGRATION_GUIDE.md` - Detailed guide
- `INTEGRATION_EXAMPLE.md` - Integration examples

## Next Steps

1. Build WASM: `npm run build:wasm`
2. Initialize in app: Add `initWasm()` call
3. Replace imports: Switch to WASM versions
4. Test performance: Compare before/after
5. Deploy: WASM files are included in Next.js build
