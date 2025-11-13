import { ASCII_CHARS } from "../store/ascii-store";

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

// Helper function to clamp values
const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

// Generate a normalized 2D Gaussian kernel
const gaussianKernel2D = (sigma: number, kernelSize: number): number[][] => {
  const kernel: number[][] = [];
  const half = Math.floor(kernelSize / 2);
  let sum = 0;

  for (let y = -half; y <= half; y++) {
    const row: number[] = [];
    for (let x = -half; x <= half; x++) {
      const value = Math.exp(-(x * x + y * y) / (2 * sigma * sigma));
      row.push(value);
      sum += value;
    }
    kernel.push(row);
  }

  // Normalize the kernel
  for (let y = 0; y < kernelSize; y++) {
    for (let x = 0; x < kernelSize; x++) {
      kernel[y][x] /= sum;
    }
  }

  return kernel;
};

// Convolve a 2D image (array) with a 2D kernel
const convolve2D = (img: number[][], kernel: number[][]): number[][] => {
  const height = img.length;
  const width = img[0].length;
  const kernelSize = kernel.length;
  const half = Math.floor(kernelSize / 2);
  const output: number[][] = [];

  for (let y = 0; y < height; y++) {
    output[y] = [];
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let ky = 0; ky < kernelSize; ky++) {
        for (let kx = 0; kx < kernelSize; kx++) {
          const yy = y + ky - half;
          const xx = x + kx - half;
          const pixel =
            yy >= 0 && yy < height && xx >= 0 && xx < width ? img[yy][xx] : 0;
          sum += pixel * kernel[ky][kx];
        }
      }
      output[y][x] = sum;
    }
  }

  return output;
};

// Compute the Difference of Gaussians on a 2D grayscale image
const differenceOfGaussians2D = (
  gray: number[][],
  sigma1: number,
  sigma2: number,
  kernelSize: number
): number[][] => {
  const kernel1 = gaussianKernel2D(sigma1, kernelSize);
  const kernel2 = gaussianKernel2D(sigma2, kernelSize);
  const blurred1 = convolve2D(gray, kernel1);
  const blurred2 = convolve2D(gray, kernel2);
  const height = gray.length;
  const width = gray[0].length;
  const dog: number[][] = [];

  for (let y = 0; y < height; y++) {
    dog[y] = [];
    for (let x = 0; x < width; x++) {
      dog[y][x] = blurred1[y][x] - blurred2[y][x];
    }
  }

  return dog;
};

// Apply the Sobel operator to a 2D image, returning gradient magnitude and angle arrays
const applySobel2D = (
  img: number[][],
  width: number,
  height: number
): { mag: number[][]; angle: number[][] } => {
  const mag: number[][] = [];
  const angle: number[][] = [];

  for (let y = 0; y < height; y++) {
    mag[y] = [];
    angle[y] = [];
    for (let x = 0; x < width; x++) {
      mag[y][x] = 0;
      angle[y][x] = 0;
    }
  }

  const kernelX = [
    [-1, 0, 1],
    [-2, 0, 2],
    [-1, 0, 1],
  ];
  const kernelY = [
    [-1, -2, -1],
    [0, 0, 0],
    [1, 2, 1],
  ];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let Gx = 0;
      let Gy = 0;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const pixel = img[y + ky][x + kx];
          Gx += pixel * kernelX[ky + 1][kx + 1];
          Gy += pixel * kernelY[ky + 1][kx + 1];
        }
      }

      const g = Math.sqrt(Gx * Gx + Gy * Gy);
      mag[y][x] = g;
      let theta = Math.atan2(Gy, Gx) * (180 / Math.PI);
      if (theta < 0) theta += 180;
      angle[y][x] = theta;
    }
  }

  return { mag, angle };
};

// Non-maximum suppression to thin out the edges
const nonMaxSuppression = (
  mag: number[][],
  angle: number[][],
  width: number,
  height: number
): number[][] => {
  const suppressed: number[][] = [];

  for (let y = 0; y < height; y++) {
    suppressed[y] = [];
    for (let x = 0; x < width; x++) {
      suppressed[y][x] = 0;
    }
  }

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const currentMag = mag[y][x];
      let neighbor1 = 0;
      let neighbor2 = 0;
      const theta = angle[y][x];

      if ((theta >= 0 && theta < 22.5) || (theta >= 157.5 && theta <= 180)) {
        // 0° direction: compare left and right
        neighbor1 = mag[y][x - 1];
        neighbor2 = mag[y][x + 1];
      } else if (theta >= 22.5 && theta < 67.5) {
        // 45° direction: compare top-right and bottom-left
        neighbor1 = mag[y - 1][x + 1];
        neighbor2 = mag[y + 1][x - 1];
      } else if (theta >= 67.5 && theta < 112.5) {
        // 90° direction: compare top and bottom
        neighbor1 = mag[y - 1][x];
        neighbor2 = mag[y + 1][x];
      } else if (theta >= 112.5 && theta < 157.5) {
        // 135° direction: compare top-left and bottom-right
        neighbor1 = mag[y - 1][x - 1];
        neighbor2 = mag[y + 1][x + 1];
      }

      suppressed[y][x] =
        currentMag >= neighbor1 && currentMag >= neighbor2 ? currentMag : 0;
    }
  }

  return suppressed;
};

// Apply simple Sobel edge detection on a 1D grayscale array (for standard mode)
const applySobelEdgeDetection = (
  gray: number[],
  width: number,
  height: number,
  threshold: number
): number[] => {
  const edges = new Array(width * height).fill(255);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;

      const a = gray[(y - 1) * width + (x - 1)];
      const b = gray[(y - 1) * width + x];
      const c = gray[(y - 1) * width + (x + 1)];
      const d = gray[y * width + (x - 1)];
      const e = gray[y * width + x];
      const f = gray[y * width + (x + 1)];
      const g = gray[(y + 1) * width + (x - 1)];
      const h = gray[(y + 1) * width + x];
      const i = gray[(y + 1) * width + (x + 1)];

      const Gx =
        -1 * a +
        0 * b +
        1 * c +
        -2 * d +
        0 * e +
        2 * f +
        -1 * g +
        0 * h +
        1 * i;

      const Gy =
        -1 * a +
        -2 * b +
        -1 * c +
        0 * d +
        0 * e +
        0 * f +
        1 * g +
        2 * h +
        1 * i;

      const magVal = Math.sqrt(Gx * Gx + Gy * Gy);
      const normalized = (magVal / 1442) * 255;

      edges[idx] = normalized > threshold ? 0 : 255;
    }
  }

  return edges;
};

// Dithering functions work on grayscale arrays
const applyFloydSteinbergDithering = (
  gray: number[],
  width: number,
  height: number,
  nLevels: number
): number[] => {
  const result = [...gray];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const computedLevel = Math.round((result[idx] / 255) * (nLevels - 1));
      const newPixel = (computedLevel / (nLevels - 1)) * 255;
      const error = result[idx] - newPixel;

      result[idx] = newPixel;

      if (x + 1 < width) {
        result[idx + 1] = clamp(result[idx + 1] + error * (7 / 16), 0, 255);
      }
      if (x - 1 >= 0 && y + 1 < height) {
        result[idx - 1 + width] = clamp(
          result[idx - 1 + width] + error * (3 / 16),
          0,
          255
        );
      }
      if (y + 1 < height) {
        result[idx + width] = clamp(
          result[idx + width] + error * (5 / 16),
          0,
          255
        );
      }
      if (x + 1 < width && y + 1 < height) {
        result[idx + width + 1] = clamp(
          result[idx + width + 1] + error * (1 / 16),
          0,
          255
        );
      }
    }
  }

  return result;
};

const applyAtkinsonDithering = (
  gray: number[],
  width: number,
  height: number,
  nLevels: number
): number[] => {
  const result = [...gray];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const computedLevel = Math.round((result[idx] / 255) * (nLevels - 1));
      const newPixel = (computedLevel / (nLevels - 1)) * 255;
      const error = result[idx] - newPixel;
      const diffusion = error / 8;

      result[idx] = newPixel;

      if (x + 1 < width) {
        result[idx + 1] = clamp(result[idx + 1] + diffusion, 0, 255);
      }
      if (x + 2 < width) {
        result[idx + 2] = clamp(result[idx + 2] + diffusion, 0, 255);
      }
      if (y + 1 < height) {
        if (x - 1 >= 0) {
          result[idx - 1 + width] = clamp(
            result[idx - 1 + width] + diffusion,
            0,
            255
          );
        }
        result[idx + width] = clamp(result[idx + width] + diffusion, 0, 255);
        if (x + 1 < width) {
          result[idx + width + 1] = clamp(
            result[idx + width + 1] + diffusion,
            0,
            255
          );
        }
      }
      if (y + 2 < height) {
        result[idx + 2 * width] = clamp(
          result[idx + 2 * width] + diffusion,
          0,
          255
        );
      }
    }
  }

  return result;
};

const applyNoiseDithering = (
  gray: number[],
  width: number,
  height: number,
  nLevels: number
): number[] => {
  const result: number[] = [];

  for (let i = 0; i < gray.length; i++) {
    const noise = (Math.random() - 0.5) * (255 / nLevels);
    const noisyValue = clamp(gray[i] + noise, 0, 255);
    const quantized =
      Math.round((noisyValue / 255) * (nLevels - 1)) * (255 / (nLevels - 1));
    result.push(quantized);
  }

  return result;
};

const applyOrderedDithering = (
  gray: number[],
  width: number,
  height: number,
  nLevels: number
): number[] => {
  const result: number[] = [];
  const bayer = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
  ];
  const matrixSize = 4;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const p = gray[idx] / 255;
      const t =
        (bayer[y % matrixSize][x % matrixSize] + 0.5) /
        (matrixSize * matrixSize);
      let valueWithDither = p + t - 0.5;
      valueWithDither = Math.min(Math.max(valueWithDither, 0), 1);
      let computedLevel = Math.floor(valueWithDither * nLevels);
      if (computedLevel >= nLevels) computedLevel = nLevels - 1;
      result.push((computedLevel / (nLevels - 1)) * 255);
    }
  }

  return result;
};

export const convertCanvasToAscii = ({
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
  const height = canvas.height;
  const imageData = canvas
    .getContext("2d", { alpha: false })
    ?.getImageData(0, 0, width, height);
  if (!imageData) return "";

  const data = imageData.data;

  // Special handling for DoG contour mode
  if (edgeMethod === "dog") {
    return generateContourASCII(
      data,
      width,
      height,
      invert,
      brightness,
      contrast,
      dogThreshold[0]
    );
  }

  // Convert to grayscale and apply brightness/contrast
  const contrastFactor =
    (259 * (contrast[0] + 255)) / (255 * (259 - contrast[0]));
  let gray: number[] = [];
  const grayOriginal: number[] = [];

  for (let i = 0; i < data.length; i += 4) {
    let lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    if (invert) lum = 255 - lum;
    const adjusted = clamp(
      contrastFactor * (lum - 128) + 128 + brightness[0],
      0,
      255
    );
    gray.push(adjusted);
    grayOriginal.push(adjusted);
  }

  // Apply Sobel edge detection if enabled
  if (edgeMethod === "sobel") {
    gray = applySobelEdgeDetection(gray, width, height, edgeThreshold[0]);
  }

  // Get character set
  const chars = charset === "manual" ? manualChar : ASCII_CHARS[charset];
  const charArray = chars.split("");
  const nLevels = charArray.length;

  // Apply dithering if enabled
  if (dithering && edgeMethod !== "sobel") {
    switch (ditherAlgorithm) {
      case "floyd":
        gray = applyFloydSteinbergDithering(gray, width, height, nLevels);
        break;
      case "atkinson":
        gray = applyAtkinsonDithering(gray, width, height, nLevels);
        break;
      case "noise":
        gray = applyNoiseDithering(gray, width, height, nLevels);
        break;
      case "ordered":
        gray = applyOrderedDithering(gray, width, height, nLevels);
        break;
    }
  }

  // Convert to ASCII
  let ascii = "";
  for (let y = 0; y < height; y++) {
    let line = "";
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (ignoreWhite && grayOriginal[idx] === 255) {
        line += " ";
        continue;
      }
      const computedLevel = Math.round((gray[idx] / 255) * (nLevels - 1));
      line += charArray[computedLevel];
    }
    ascii += line + "\n";
  }

  return ascii;
};

// Generate contour-based ASCII art using DoG and Sobel with non-maximum suppression
const generateContourASCII = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  invert: boolean,
  brightness: number[],
  contrast: number[],
  threshold: number
): string => {
  // Convert to 2D grayscale array with brightness/contrast
  const contrastFactor =
    (259 * (contrast[0] + 255)) / (255 * (259 - contrast[0]));
  const gray2d: number[][] = [];

  for (let y = 0; y < height; y++) {
    gray2d[y] = [];
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      let lum =
        0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      if (invert) lum = 255 - lum;
      lum = clamp(contrastFactor * (lum - 128) + 128 + brightness[0], 0, 255);
      gray2d[y][x] = lum;
    }
  }

  // Apply DoG
  const sigma1 = 0.5;
  const sigma2 = 1.0;
  const kernelSize = 3;
  const dog = differenceOfGaussians2D(gray2d, sigma1, sigma2, kernelSize);

  // Apply Sobel
  const { mag, angle } = applySobel2D(dog, width, height);

  // Non-maximum suppression
  const suppressedMag = nonMaxSuppression(mag, angle, width, height);

  // Generate ASCII with directional characters
  let ascii = "";
  for (let y = 0; y < height; y++) {
    let line = "";
    for (let x = 0; x < width; x++) {
      if (suppressedMag[y][x] > threshold) {
        let adjustedAngle = (angle[y][x] + 90) % 180;
        let edgeChar =
          adjustedAngle < 22.5 || adjustedAngle >= 157.5
            ? "-"
            : adjustedAngle < 67.5
            ? "/"
            : adjustedAngle < 112.5
            ? "|"
            : "\\";
        line += edgeChar;
      } else {
        line += " ";
      }
    }
    ascii += line + "\n";
  }

  return ascii;
};

interface ProcessCanvasOptions {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  blur: number[];
}

export const processCanvasWithFilters = ({
  canvas,
  width,
  height,
  blur,
}: ProcessCanvasOptions): void => {
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;

  // Apply blur filter (brightness/contrast are applied in conversion)
  ctx.filter = blur[0] > 0 ? `blur(${blur[0]}px)` : "none";
};

// Helper function to create or reuse a canvas with specified dimensions
export const getOrCreateCanvas = (
  existingCanvas: HTMLCanvasElement | null,
  width: number,
  height: number
): HTMLCanvasElement => {
  if (
    existingCanvas &&
    existingCanvas.width === width &&
    existingCanvas.height === height
  ) {
    // Reuse existing canvas if dimensions match
    const ctx = existingCanvas.getContext("2d", { alpha: false });
    if (ctx) {
      ctx.clearRect(0, 0, width, height);
    }
    return existingCanvas;
  }

  // Create new canvas if dimensions don't match or doesn't exist
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

// Helper function to create canvas from image
export const createCanvasFromImage = (
  img: HTMLImageElement,
  width: number,
  blur: number[]
): HTMLCanvasElement => {
  const height = Math.floor((img.height / img.width) * width * 0.55);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return canvas;

  processCanvasWithFilters({ canvas, width, height, blur });
  ctx.drawImage(img, 0, 0, width, height);

  return canvas;
};

// Helper function to create canvas from text
export const createCanvasFromText = (
  text: string,
  width: number,
  blur: number[]
): HTMLCanvasElement => {
  const height = Math.floor(width * 0.55);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return canvas;

  // Create temporary canvas for text
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext("2d", { alpha: false });
  if (!tempCtx) return canvas;

  // Draw text on temp canvas
  tempCtx.fillStyle = "#fff";
  tempCtx.fillRect(0, 0, width, height);
  tempCtx.fillStyle = "#000";
  tempCtx.font = `${Math.floor(width / 8)}px monospace`;
  tempCtx.textAlign = "center";
  tempCtx.textBaseline = "middle";

  const lines = text.split("\n");
  const lineHeight = height / Math.max(lines.length, 1);
  lines.forEach((line, index) => {
    tempCtx.fillText(line, width / 2, lineHeight * (index + 0.5), width - 20);
  });

  // Apply filters and draw to main canvas
  processCanvasWithFilters({ canvas, width, height, blur });
  ctx.drawImage(tempCanvas, 0, 0);

  return canvas;
};

// Shared generation function that works for both image and text
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

export const generateAsciiFromImage = (
  imageDataUrl: string,
  options: GenerateAsciiOptions
): void => {
  const img = document.createElement("img");
  img.crossOrigin = "anonymous";
  img.onload = () => {
    const width = Math.floor(options.asciiWidth[0]);
    const canvas = createCanvasFromImage(img, width, options.blur);

    const ascii = convertCanvasToAscii({
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
  img.src = imageDataUrl;
};

export const generateAsciiFromText = (
  text: string,
  options: GenerateAsciiOptions
): void => {
  if (!text.trim()) {
    options.setAsciiOutput("");
    return;
  }

  const width = Math.floor(options.asciiWidth[0]);
  const canvas = createCanvasFromText(text, width, options.blur);

  const ascii = convertCanvasToAscii({
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
