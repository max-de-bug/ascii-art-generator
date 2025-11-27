use wasm_bindgen::prelude::*;

// Image compression module
mod image_compression;
pub use image_compression::*;

// Sphere animation module
mod sphere_animation;
pub use sphere_animation::*;

// Text in center module
mod text_in_center;
pub use text_in_center::*;

// Helper function to clamp values
#[inline]
fn clamp(value: f64, min: f64, max: f64) -> f64 {
    value.max(min).min(max)
}

// Convert RGB to grayscale luminance
#[inline]
fn rgb_to_luminance(r: u8, g: u8, b: u8) -> f64 {
    0.299 * r as f64 + 0.587 * g as f64 + 0.114 * b as f64
}

// Generate a normalized 2D Gaussian kernel
fn gaussian_kernel_2d(sigma: f64, kernel_size: usize) -> Vec<Vec<f64>> {
    let half = kernel_size / 2;
    let mut kernel = vec![vec![0.0; kernel_size]; kernel_size];
    let mut sum = 0.0;

    for y in 0..kernel_size {
        for x in 0..kernel_size {
            let dy = y as i32 - half as i32;
            let dx = x as i32 - half as i32;
            let value = (-(dx * dx + dy * dy) as f64 / (2.0 * sigma * sigma)).exp();
            kernel[y][x] = value;
            sum += value;
        }
    }

    // Normalize the kernel
    for y in 0..kernel_size {
        for x in 0..kernel_size {
            kernel[y][x] /= sum;
        }
    }

    kernel
}

// Convolve a 2D image with a 2D kernel
fn convolve_2d(img: &[Vec<f64>], kernel: &[Vec<f64>]) -> Vec<Vec<f64>> {
    let height = img.len();
    let width = img[0].len();
    let kernel_size = kernel.len();
    let half = kernel_size / 2;
    let mut output = vec![vec![0.0; width]; height];

    for y in 0..height {
        for x in 0..width {
            let mut sum = 0.0;
            for ky in 0..kernel_size {
                for kx in 0..kernel_size {
                    let yy = y as i32 + ky as i32 - half as i32;
                    let xx = x as i32 + kx as i32 - half as i32;
                    let pixel = if yy >= 0 && yy < height as i32 && xx >= 0 && xx < width as i32 {
                        img[yy as usize][xx as usize]
                    } else {
                        0.0
                    };
                    sum += pixel * kernel[ky][kx];
                }
            }
            output[y][x] = sum;
        }
    }

    output
}

// Difference of Gaussians
fn difference_of_gaussians_2d(
    gray: &[Vec<f64>],
    sigma1: f64,
    sigma2: f64,
    kernel_size: usize,
) -> Vec<Vec<f64>> {
    let kernel1 = gaussian_kernel_2d(sigma1, kernel_size);
    let kernel2 = gaussian_kernel_2d(sigma2, kernel_size);
    let blurred1 = convolve_2d(gray, &kernel1);
    let blurred2 = convolve_2d(gray, &kernel2);
    let height = gray.len();
    let width = gray[0].len();
    let mut dog = vec![vec![0.0; width]; height];

    for y in 0..height {
        for x in 0..width {
            dog[y][x] = blurred1[y][x] - blurred2[y][x];
        }
    }

    dog
}

// Apply Sobel operator to 2D image
fn apply_sobel_2d(img: &[Vec<f64>], width: usize, height: usize) -> (Vec<Vec<f64>>, Vec<Vec<f64>>) {
    let kernel_x = vec![
        vec![-1.0, 0.0, 1.0],
        vec![-2.0, 0.0, 2.0],
        vec![-1.0, 0.0, 1.0],
    ];
    let kernel_y = vec![
        vec![-1.0, -2.0, -1.0],
        vec![0.0, 0.0, 0.0],
        vec![1.0, 2.0, 1.0],
    ];

    let mut mag = vec![vec![0.0; width]; height];
    let mut angle = vec![vec![0.0; width]; height];

    for y in 1..height - 1 {
        for x in 1..width - 1 {
            let mut gx = 0.0;
            let mut gy = 0.0;

            for ky in 0..3 {
                for kx in 0..3 {
                    let py = (y + ky) as i32 - 1;
                    let px = (x + kx) as i32 - 1;
                    let pixel = img[py as usize][px as usize];
                    gx += pixel * kernel_x[ky][kx];
                    gy += pixel * kernel_y[ky][kx];
                }
            }

            mag[y][x] = (gx * gx + gy * gy).sqrt();
            let mut theta = gy.atan2(gx) * 180.0 / std::f64::consts::PI;
            if theta < 0.0 {
                theta += 180.0;
            }
            angle[y][x] = theta;
        }
    }

    (mag, angle)
}

// Non-maximum suppression
fn non_max_suppression(
    mag: &[Vec<f64>],
    angle: &[Vec<f64>],
    width: usize,
    height: usize,
) -> Vec<Vec<f64>> {
    let mut suppressed = vec![vec![0.0; width]; height];

    for y in 1..height - 1 {
        for x in 1..width - 1 {
            let current_mag = mag[y][x];
            let theta = angle[y][x];
            let (neighbor1, neighbor2) = if (theta >= 0.0 && theta < 22.5) || (theta >= 157.5 && theta <= 180.0) {
                // 0° direction
                (mag[y][x - 1], mag[y][x + 1])
            } else if theta >= 22.5 && theta < 67.5 {
                // 45° direction
                (mag[y - 1][x + 1], mag[y + 1][x - 1])
            } else if theta >= 67.5 && theta < 112.5 {
                // 90° direction
                (mag[y - 1][x], mag[y + 1][x])
            } else {
                // 135° direction
                (mag[y - 1][x - 1], mag[y + 1][x + 1])
            };

            suppressed[y][x] = if current_mag >= neighbor1 && current_mag >= neighbor2 {
                current_mag
            } else {
                0.0
            };
        }
    }

    suppressed
}

// Apply Sobel edge detection on 1D grayscale array
fn apply_sobel_edge_detection(
    gray: &[f64],
    width: usize,
    height: usize,
    threshold: f64,
) -> Vec<f64> {
    let mut edges = vec![255.0; width * height];

    for y in 1..height - 1 {
        for x in 1..width - 1 {
            let idx = y * width + x;

            let a = gray[(y - 1) * width + (x - 1)];
            let b = gray[(y - 1) * width + x];
            let c = gray[(y - 1) * width + (x + 1)];
            let d = gray[y * width + (x - 1)];
            let e = gray[y * width + x];
            let f = gray[y * width + (x + 1)];
            let g = gray[(y + 1) * width + (x - 1)];
            let h = gray[(y + 1) * width + x];
            let i = gray[(y + 1) * width + (x + 1)];

            let gx = -1.0 * a + 1.0 * c + -2.0 * d + 2.0 * f + -1.0 * g + 1.0 * i;
            let gy = -1.0 * a + -2.0 * b + -1.0 * c + 1.0 * g + 2.0 * h + 1.0 * i;

            let mag_val = (gx * gx + gy * gy).sqrt();
            let normalized = (mag_val / 1442.0) * 255.0;

            edges[idx] = if normalized > threshold { 0.0 } else { 255.0 };
        }
    }

    edges
}

// Floyd-Steinberg dithering
fn apply_floyd_steinberg_dithering(
    gray: &[f64],
    width: usize,
    height: usize,
    n_levels: usize,
) -> Vec<f64> {
    let mut result = gray.to_vec();

    for y in 0..height {
        for x in 0..width {
            let idx = y * width + x;
            let computed_level = ((result[idx] / 255.0) * (n_levels - 1) as f64).round() as usize;
            let new_pixel = (computed_level as f64 / (n_levels - 1) as f64) * 255.0;
            let error = result[idx] - new_pixel;

            result[idx] = new_pixel;

            if x + 1 < width {
                result[idx + 1] = clamp(result[idx + 1] + error * (7.0 / 16.0), 0.0, 255.0);
            }
            if x > 0 && y + 1 < height {
                result[idx - 1 + width] = clamp(
                    result[idx - 1 + width] + error * (3.0 / 16.0),
                    0.0,
                    255.0,
                );
            }
            if y + 1 < height {
                result[idx + width] = clamp(result[idx + width] + error * (5.0 / 16.0), 0.0, 255.0);
            }
            if x + 1 < width && y + 1 < height {
                result[idx + width + 1] = clamp(
                    result[idx + width + 1] + error * (1.0 / 16.0),
                    0.0,
                    255.0,
                );
            }
        }
    }

    result
}

// Atkinson dithering
fn apply_atkinson_dithering(
    gray: &[f64],
    width: usize,
    height: usize,
    n_levels: usize,
) -> Vec<f64> {
    let mut result = gray.to_vec();

    for y in 0..height {
        for x in 0..width {
            let idx = y * width + x;
            let computed_level = ((result[idx] / 255.0) * (n_levels - 1) as f64).round() as usize;
            let new_pixel = (computed_level as f64 / (n_levels - 1) as f64) * 255.0;
            let error = result[idx] - new_pixel;
            let diffusion = error / 8.0;

            result[idx] = new_pixel;

            if x + 1 < width {
                result[idx + 1] = clamp(result[idx + 1] + diffusion, 0.0, 255.0);
            }
            if x + 2 < width {
                result[idx + 2] = clamp(result[idx + 2] + diffusion, 0.0, 255.0);
            }
            if y + 1 < height {
                if x > 0 {
                    result[idx - 1 + width] = clamp(result[idx - 1 + width] + diffusion, 0.0, 255.0);
                }
                result[idx + width] = clamp(result[idx + width] + diffusion, 0.0, 255.0);
                if x + 1 < width {
                    result[idx + width + 1] = clamp(result[idx + width + 1] + diffusion, 0.0, 255.0);
                }
            }
            if y + 2 < height {
                result[idx + 2 * width] = clamp(result[idx + 2 * width] + diffusion, 0.0, 255.0);
            }
        }
    }

    result
}

// Noise dithering
// Note: For proper random noise, you'd need to add the `rand` crate
// This is a deterministic approximation using pixel-based pseudo-randomness
fn apply_noise_dithering(
    gray: &[f64],
    _width: usize,
    _height: usize,
    n_levels: usize,
) -> Vec<f64> {
    gray.iter()
        .enumerate()
        .map(|(i, &pixel)| {
            // Simple pseudo-random noise based on index and pixel value
            let seed = (i as f64 * 17.0 + pixel) % 1000.0;
            let noise = ((seed / 1000.0) - 0.5) * (255.0 / n_levels as f64);
            let noisy_value = clamp(pixel + noise, 0.0, 255.0);
            ((noisy_value / 255.0) * (n_levels - 1) as f64).round() * (255.0 / (n_levels - 1) as f64)
        })
        .collect()
}

// Ordered dithering (Bayer matrix)
fn apply_ordered_dithering(
    gray: &[f64],
    width: usize,
    height: usize,
    n_levels: usize,
) -> Vec<f64> {
    let bayer = vec![
        vec![0, 8, 2, 10],
        vec![12, 4, 14, 6],
        vec![3, 11, 1, 9],
        vec![15, 7, 13, 5],
    ];
    let matrix_size = 4;
    let mut result = Vec::with_capacity(gray.len());

    for y in 0..height {
        for x in 0..width {
            let idx = y * width + x;
            let p = gray[idx] / 255.0;
            let t = (bayer[y % matrix_size][x % matrix_size] as f64 + 0.5)
                / (matrix_size * matrix_size) as f64;
            let mut value_with_dither = p + t - 0.5;
            value_with_dither = value_with_dither.max(0.0).min(1.0);
            let mut computed_level = (value_with_dither * n_levels as f64) as usize;
            if computed_level >= n_levels {
                computed_level = n_levels - 1;
            }
            result.push((computed_level as f64 / (n_levels - 1) as f64) * 255.0);
        }
    }

    result
}

// Generate contour ASCII using DoG
fn generate_contour_ascii(
    data: &[u8],
    width: usize,
    height: usize,
    invert: bool,
    brightness: f64,
    contrast: f64,
    threshold: f64,
) -> String {
    // Convert to 2D grayscale
    let contrast_factor = (259.0 * (contrast + 255.0)) / (255.0 * (259.0 - contrast));
    let mut gray_2d = vec![vec![0.0; width]; height];

    for y in 0..height {
        for x in 0..width {
            let idx = (y * width + x) * 4;
            let mut lum = rgb_to_luminance(data[idx], data[idx + 1], data[idx + 2]);
            if invert {
                lum = 255.0 - lum;
            }
            lum = clamp(
                contrast_factor * (lum - 128.0) + 128.0 + brightness,
                0.0,
                255.0,
            );
            gray_2d[y][x] = lum;
        }
    }

    // Apply DoG
    let sigma1 = 0.5;
    let sigma2 = 1.0;
    let kernel_size = 3;
    let dog = difference_of_gaussians_2d(&gray_2d, sigma1, sigma2, kernel_size);

    // Apply Sobel
    let (mag, angle) = apply_sobel_2d(&dog, width, height);

    // Non-maximum suppression
    let suppressed_mag = non_max_suppression(&mag, &angle, width, height);

    // Generate ASCII
    let mut ascii = String::new();
    for y in 0..height {
        for x in 0..width {
            if suppressed_mag[y][x] > threshold {
                let adjusted_angle = (angle[y][x] + 90.0) % 180.0;
                let edge_char = if adjusted_angle < 22.5 || adjusted_angle >= 157.5 {
                    "-"
                } else if adjusted_angle < 67.5 {
                    "/"
                } else if adjusted_angle < 112.5 {
                    "|"
                } else {
                    "\\"
                };
                ascii.push_str(edge_char);
            } else {
                ascii.push(' ');
            }
        }
        ascii.push('\n');
    }

    ascii
}

// Main conversion function
#[wasm_bindgen]
pub fn convert_to_ascii(
    data: &[u8],
    width: usize,
    height: usize,
    invert: bool,
    charset: &str,
    manual_char: &str,
    ignore_white: bool,
    dithering: bool,
    dither_algorithm: &str,
    edge_method: &str,
    edge_threshold: f64,
    dog_threshold: f64,
    brightness: f64,
    contrast: f64,
) -> String {
    // Special handling for DoG contour mode
    if edge_method == "dog" {
        return generate_contour_ascii(data, width, height, invert, brightness, contrast, dog_threshold);
    }

    // Convert to grayscale and apply brightness/contrast
    let contrast_factor = (259.0 * (contrast + 255.0)) / (255.0 * (259.0 - contrast));
    let mut gray = Vec::with_capacity(width * height);
    let mut gray_original = Vec::with_capacity(width * height);

    for i in (0..data.len()).step_by(4) {
        let mut lum = rgb_to_luminance(data[i], data[i + 1], data[i + 2]);
        if invert {
            lum = 255.0 - lum;
        }
        let adjusted = clamp(
            contrast_factor * (lum - 128.0) + 128.0 + brightness,
            0.0,
            255.0,
        );
        gray.push(adjusted);
        gray_original.push(adjusted);
    }

    // Apply Sobel edge detection if enabled
    if edge_method == "sobel" {
        gray = apply_sobel_edge_detection(&gray, width, height, edge_threshold);
    }

    // Get character set
    let chars = if charset == "manual" {
        manual_char
    } else {
        charset
    };
    let char_array: Vec<char> = chars.chars().collect();
    let n_levels = char_array.len();

    // Apply dithering if enabled
    if dithering && edge_method != "sobel" {
        gray = match dither_algorithm {
            "floyd" => apply_floyd_steinberg_dithering(&gray, width, height, n_levels),
            "atkinson" => apply_atkinson_dithering(&gray, width, height, n_levels),
            "noise" => apply_noise_dithering(&gray, width, height, n_levels),
            "ordered" => apply_ordered_dithering(&gray, width, height, n_levels),
            _ => gray,
        };
    }

    // Convert to ASCII
    let mut ascii = String::new();
    for y in 0..height {
        for x in 0..width {
            let idx = y * width + x;
            if ignore_white && gray_original[idx] == 255.0 {
                ascii.push(' ');
                continue;
            }
            let computed_level = ((gray[idx] / 255.0) * (n_levels - 1) as f64).round() as usize;
            let char_idx = computed_level.min(n_levels - 1);
            ascii.push(char_array[char_idx]);
        }
        ascii.push('\n');
    }

    ascii
}

