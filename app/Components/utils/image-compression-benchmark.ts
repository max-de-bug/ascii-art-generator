/**
 * Image Compression Benchmark
 * 
 * Compares Rust WASM image compression vs no compression
 * Measures file size, processing time, and compression ratios
 * 
 * Usage:
 *   import { runCompressionBenchmark } from './image-compression-benchmark';
 *   await runCompressionBenchmark(imageFile, options);
 */

import { loadWasmModule } from "./сompress-image-wasm";

export interface CompressionBenchmarkOptions {
  maxWidth?: number; // Maximum width for compression (default: 2048)
  quality?: number; // JPEG quality 0-100 (default: 85)
  format?: "jpeg" | "png"; // Output format (default: "jpeg")
  iterations?: number; // Number of test iterations (default: 5)
  warmupIterations?: number; // Warmup iterations (default: 1)
}

export interface CompressionResult {
  originalSize: number; // bytes
  compressedSize: number; // bytes
  compressionRatio: number; // compressed / original (lower is better)
  sizeReduction: number; // percentage reduction
  processingTime: number; // milliseconds
  originalDimensions: { width: number; height: number };
  compressedDimensions: { width: number; height: number };
}

export interface CompressionBenchmarkResult {
  withoutCompression: {
    size: number;
    dimensions: { width: number; height: number };
    loadTime: number;
  };
  withCompression: CompressionResult;
  comparison: {
    sizeSaved: number; // bytes saved
    sizeSavedPercentage: number; // percentage saved
    processingTime: number; // time to compress
    compressionEfficiency: number; // bytes saved per millisecond
  };
}

/**
 * Get image dimensions without full decode
 */
async function getImageDimensions(imageData: Uint8Array): Promise<{ width: number; height: number }> {
  const wasm = await loadWasmModule();
  if (wasm && wasm.get_image_dimensions) {
    try {
      const [width, height] = wasm.get_image_dimensions(imageData);
      return { width, height };
    } catch (error) {
      console.warn("Failed to get dimensions from WASM:", error);
    }
  }

  // Fallback: create image element and measure
  return new Promise((resolve) => {
    const blob = new Blob([imageData]);
    const url = URL.createObjectURL(blob);
    const img = document.createElement("img");
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve({ width: 0, height: 0 });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

/**
 * Run a single compression test
 */
async function runSingleCompressionTest(
  imageData: Uint8Array,
  options: Required<CompressionBenchmarkOptions>
): Promise<CompressionResult> {
  const wasm = await loadWasmModule();
  
  if (!wasm || !wasm.compress_image) {
    throw new Error("WASM compression module not available. Run 'npm run build:wasm' first.");
  }

  // Get original dimensions
  const originalDimensions = await getImageDimensions(imageData);
  
  // Measure compression time
  const start = performance.now();
  const compressedData = wasm.compress_image(
    imageData,
    options.maxWidth,
    options.quality,
    options.format
  );
  const end = performance.now();
  
  // Get compressed dimensions
  const compressedDimensions = await getImageDimensions(compressedData);
  
  const originalSize = imageData.length;
  const compressedSize = compressedData.length;
  const compressionRatio = compressedSize / originalSize;
  const sizeReduction = ((originalSize - compressedSize) / originalSize) * 100;
  const processingTime = end - start;

  return {
    originalSize,
    compressedSize,
    compressionRatio,
    sizeReduction,
    processingTime,
    originalDimensions,
    compressedDimensions,
  };
}

/**
 * Run compression benchmark
 */
export async function runCompressionBenchmark(
  imageFile: File | Blob,
  options: CompressionBenchmarkOptions = {}
): Promise<CompressionBenchmarkResult> {
  const opts: Required<CompressionBenchmarkOptions> = {
    maxWidth: options.maxWidth ?? 2048,
    quality: options.quality ?? 85,
    format: options.format ?? "jpeg",
    iterations: options.iterations ?? 5,
    warmupIterations: options.warmupIterations ?? 1,
  };

  console.log("🖼️ Starting image compression benchmark...");
  console.log(`   File: ${imageFile instanceof File ? imageFile.name : "Blob"}`);
  console.log(`   Max width: ${opts.maxWidth}px`);
  console.log(`   Quality: ${opts.quality}`);
  console.log(`   Format: ${opts.format}`);
  console.log(`   Iterations: ${opts.iterations}`);

  // Load image data
  const imageData = new Uint8Array(await imageFile.arrayBuffer());
  const originalSize = imageData.length;
  
  console.log(`   Original size: ${(originalSize / 1024).toFixed(2)} KB`);

  // Get original dimensions
  const originalDimensions = await getImageDimensions(imageData);
  console.log(`   Original dimensions: ${originalDimensions.width}×${originalDimensions.height}px`);

  // Warmup
  console.log("\n🔥 Warmup phase...");
  for (let i = 0; i < opts.warmupIterations; i++) {
    await runSingleCompressionTest(imageData, opts);
  }

  // Actual benchmark
  console.log("\n📊 Running benchmark...");
  const results: CompressionResult[] = [];
  
  for (let i = 0; i < opts.iterations; i++) {
    const result = await runSingleCompressionTest(imageData, opts);
    results.push(result);
    console.log(`   Run ${i + 1}/${opts.iterations}: ${result.compressedSize} bytes (${result.processingTime.toFixed(2)}ms)`);
  }

  // Calculate averages
  const avgResult: CompressionResult = {
    originalSize: results[0].originalSize,
    compressedSize: Math.round(
      results.reduce((sum, r) => sum + r.compressedSize, 0) / results.length
    ),
    compressionRatio:
      results.reduce((sum, r) => sum + r.compressionRatio, 0) / results.length,
    sizeReduction:
      results.reduce((sum, r) => sum + r.sizeReduction, 0) / results.length,
    processingTime:
      results.reduce((sum, r) => sum + r.processingTime, 0) / results.length,
    originalDimensions: results[0].originalDimensions,
    compressedDimensions: results[0].compressedDimensions,
  };

  // Measure load time for original (simulate no compression path)
  const loadStart = performance.now();
  const blob = new Blob([imageData]);
  const loadEnd = performance.now();
  const loadTime = loadEnd - loadStart;

  // Build comparison
  const sizeSaved = originalSize - avgResult.compressedSize;
  const sizeSavedPercentage = avgResult.sizeReduction;
  const compressionEfficiency = sizeSaved / avgResult.processingTime; // bytes saved per ms

  const comparison = {
    sizeSaved,
    sizeSavedPercentage,
    processingTime: avgResult.processingTime,
    compressionEfficiency,
  };

  return {
    withoutCompression: {
      size: originalSize,
      dimensions: originalDimensions,
      loadTime,
    },
    withCompression: avgResult,
    comparison,
  };
}

/**
 * Format benchmark results for display
 */
export function formatCompressionBenchmarkResults(
  result: CompressionBenchmarkResult
): string {
  const { withoutCompression, withCompression, comparison } = result;

  let report = "\n" + "=".repeat(70) + "\n";
  report += "  IMAGE COMPRESSION BENCHMARK RESULTS\n";
  report += "=".repeat(70) + "\n\n";

  // Without compression
  report += "Without Compression:\n";
  report += `  Size: ${formatBytes(withoutCompression.size)}\n`;
  report += `  Dimensions: ${withoutCompression.dimensions.width}×${withoutCompression.dimensions.height}px\n`;
  report += `  Load time: ${withoutCompression.loadTime.toFixed(2)} ms\n\n`;

  // With compression
  report += "With Compression:\n";
  report += `  Size: ${formatBytes(withCompression.compressedSize)}\n`;
  report += `  Dimensions: ${withCompression.compressedDimensions.width}×${withCompression.compressedDimensions.height}px\n`;
  report += `  Compression ratio: ${(withCompression.compressionRatio * 100).toFixed(1)}%\n`;
  report += `  Size reduction: ${withCompression.sizeReduction.toFixed(1)}%\n`;
  report += `  Processing time: ${withCompression.processingTime.toFixed(2)} ms\n\n`;

  // Comparison
  report += "Comparison:\n";
  report += `  Size saved: ${formatBytes(comparison.sizeSaved)} (${comparison.sizeSavedPercentage.toFixed(1)}%)\n`;
  report += `  Compression time: ${comparison.processingTime.toFixed(2)} ms\n`;
  report += `  Efficiency: ${formatBytes(comparison.compressionEfficiency)}/ms\n`;

  // Visual representation
  const originalBar = "█".repeat(50);
  const compressedBar = "█".repeat(
    Math.max(1, Math.round((withCompression.compressedSize / withoutCompression.size) * 50))
  );

  report += "\n  Size comparison:\n";
  report += `  Original:  ${originalBar} ${formatBytes(withoutCompression.size)}\n`;
  report += `  Compressed: ${compressedBar} ${formatBytes(withCompression.compressedSize)}\n`;

  report += "\n" + "=".repeat(70) + "\n";

  return report;
}

/**
 * Format bytes to human-readable format
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Run multiple compression benchmarks with different settings
 */
export interface CompressionTestConfig {
  name: string;
  maxWidth: number;
  quality: number;
  format: "jpeg" | "png";
}

export async function runMultipleCompressionTests(
  imageFile: File | Blob,
  configurations: CompressionTestConfig[],
  iterations: number = 5
): Promise<CompressionBenchmarkResult[]> {
  const results: CompressionBenchmarkResult[] = [];

  for (const config of configurations) {
    console.log(`\n🧪 Testing: ${config.name}`);
    const result = await runCompressionBenchmark(imageFile, {
      maxWidth: config.maxWidth,
      quality: config.quality,
      format: config.format,
      iterations,
    });
    results.push(result);
    console.log(formatCompressionBenchmarkResults(result));
  }

  // Summary
  console.log("\n" + "=".repeat(70));
  console.log("SUMMARY");
  console.log("=".repeat(70));
  results.forEach((result, index) => {
    const config = configurations[index];
    console.log(
      `${config.name}: ${result.comparison.sizeSavedPercentage.toFixed(1)}% reduction, ` +
      `${formatBytes(result.comparison.sizeSaved)} saved in ${result.comparison.processingTime.toFixed(2)}ms`
    );
  });

  return results;
}






