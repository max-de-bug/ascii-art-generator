"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  runCompressionBenchmark,
  formatCompressionBenchmarkResults,
  type CompressionBenchmarkOptions,
  type CompressionBenchmarkResult,
} from "./utils/image-compression-benchmark";

export const ImageCompressionBenchmark = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<CompressionBenchmarkResult | null>(null);
  const [report, setReport] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [maxWidth, setMaxWidth] = useState(2048);
  const [quality, setQuality] = useState(85);
  const [format, setFormat] = useState<"jpeg" | "png">("jpeg");
  const [iterations, setIterations] = useState(5);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setImageFile(file);
    } else {
      alert("Please select an image file");
    }
  };

  const runTest = async () => {
    if (!imageFile) {
      alert("Please upload an image first");
      return;
    }

    setIsRunning(true);
    setResults(null);
    setReport("");

    try {
      const options: CompressionBenchmarkOptions = {
        maxWidth,
        quality,
        format,
        iterations,
        warmupIterations: 1,
      };

      const result = await runCompressionBenchmark(imageFile, options);
      setResults(result);
      setReport(formatCompressionBenchmarkResults(result));
    } catch (error) {
      console.error("Compression benchmark failed:", error);
      alert(
        `Benchmark failed: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold">Image Compression Benchmark</h2>
      <p className="text-sm text-muted-foreground">
        Compare Rust WASM image compression vs no compression. See file size reduction, 
        processing time, and understand why compression is important for web applications.
      </p>

      <div className="space-y-4">
        <div>
          <Label htmlFor="image-upload">Test Image:</Label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
            id="image-upload"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            className="mt-2"
            disabled={isRunning}
          >
            {imageFile ? "Change Image" : "Upload Image"}
          </Button>
          {imageFile && (
            <div className="mt-2 space-y-2">
              <p className="text-xs text-muted-foreground">
                {imageFile.name} ({(imageFile.size / 1024).toFixed(2)} KB)
              </p>
              <img
                src={URL.createObjectURL(imageFile)}
                alt="Test image"
                className="max-w-xs max-h-32 object-contain border rounded"
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="maxWidth">Max Width (px):</Label>
            <input
              id="maxWidth"
              type="number"
              value={maxWidth}
              onChange={(e) => setMaxWidth(parseInt(e.target.value) || 2048)}
              min={100}
              max={4096}
              className="w-full mt-1 px-3 py-2 border rounded"
              disabled={isRunning}
            />
          </div>

          <div>
            <Label htmlFor="quality">JPEG Quality (0-100):</Label>
            <input
              id="quality"
              type="number"
              value={quality}
              onChange={(e) => setQuality(parseInt(e.target.value) || 85)}
              min={0}
              max={100}
              className="w-full mt-1 px-3 py-2 border rounded"
              disabled={isRunning}
            />
          </div>

          <div>
            <Label htmlFor="format">Format:</Label>
            <select
              id="format"
              value={format}
              onChange={(e) => setFormat(e.target.value as "jpeg" | "png")}
              className="w-full mt-1 px-3 py-2 border rounded"
              disabled={isRunning}
            >
              <option value="jpeg">JPEG</option>
              <option value="png">PNG</option>
            </select>
          </div>

          <div>
            <Label htmlFor="iterations">Iterations:</Label>
            <input
              id="iterations"
              type="number"
              value={iterations}
              onChange={(e) => setIterations(parseInt(e.target.value) || 5)}
              min={1}
              max={20}
              className="w-full mt-1 px-3 py-2 border rounded"
              disabled={isRunning}
            />
          </div>
        </div>

        <Button
          onClick={runTest}
          disabled={isRunning || !imageFile}
          className="w-full"
        >
          {isRunning ? "Running Benchmark..." : "Run Compression Benchmark"}
        </Button>
      </div>

      {isRunning && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
          <p className="text-sm">
            Running compression benchmark... This may take a moment.
          </p>
        </div>
      )}

      {results && (
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded border">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold">Results:</h3>
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(report);
                  alert("Results copied to clipboard!");
                }}
                variant="outline"
                size="sm"
                className="text-xs"
              >
                Copy Results
              </Button>
            </div>
            <pre className="text-xs font-mono whitespace-pre-wrap overflow-auto">
              {report}
            </pre>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-white dark:bg-gray-800 rounded border">
              <h4 className="font-semibold mb-2">Without Compression</h4>
              <div className="text-sm space-y-1">
                <div>
                  Size: {(results.withoutCompression.size / 1024).toFixed(2)} KB
                </div>
                <div>
                  Dimensions: {results.withoutCompression.dimensions.width}×
                  {results.withoutCompression.dimensions.height}px
                </div>
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-gray-800 rounded border">
              <h4 className="font-semibold mb-2">With Compression</h4>
              <div className="text-sm space-y-1">
                <div>
                  Size: {(results.withCompression.compressedSize / 1024).toFixed(2)} KB
                </div>
                <div>
                  Dimensions: {results.withCompression.compressedDimensions.width}×
                  {results.withCompression.compressedDimensions.height}px
                </div>
                <div>
                  Processing: {results.withCompression.processingTime.toFixed(2)} ms
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
            <h4 className="font-semibold mb-2 text-green-800 dark:text-green-200">
              💾 Compression Benefits
            </h4>
            <div className="text-sm space-y-1 text-green-700 dark:text-green-300">
              <div>
                <strong>Size saved:</strong>{" "}
                {(results.comparison.sizeSaved / 1024).toFixed(2)} KB (
                {results.comparison.sizeSavedPercentage.toFixed(1)}%)
              </div>
              <div>
                <strong>Compression time:</strong>{" "}
                {results.comparison.processingTime.toFixed(2)} ms
              </div>
              <div>
                <strong>Efficiency:</strong>{" "}
                {(results.comparison.compressionEfficiency / 1024).toFixed(2)} KB/ms
              </div>
            </div>
          </div>

          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
            <h4 className="font-semibold mb-2">Why Use Compression?</h4>
            <ul className="text-sm space-y-1 text-blue-700 dark:text-blue-300 list-disc list-inside">
              <li>
                <strong>Faster uploads:</strong> Smaller files upload faster to IPFS/cloud storage
              </li>
              <li>
                <strong>Lower costs:</strong> Reduced storage and bandwidth costs
              </li>
              <li>
                <strong>Better UX:</strong> Faster page loads and image display
              </li>
              <li>
                <strong>Mobile-friendly:</strong> Less data usage for mobile users
              </li>
              <li>
                <strong>IPFS efficiency:</strong> Smaller files = faster IPFS pinning and retrieval
              </li>
            </ul>
          </div>
        </div>
      )}

      <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded border text-sm">
        <h4 className="font-semibold mb-2">Usage Tips:</h4>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li>Test with different image sizes to see compression impact</li>
          <li>Lower quality (70-80) works well for ASCII art (text is forgiving)</li>
          <li>JPEG is better for photos/ASCII art, PNG for graphics with transparency</li>
          <li>Check the browser console for detailed logs</li>
          <li>Make sure WASM is built: <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded">npm run build:wasm</code></li>
        </ul>
      </div>
    </div>
  );
};




