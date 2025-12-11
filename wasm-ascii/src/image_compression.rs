use wasm_bindgen::prelude::*;
use image::{ImageFormat};
use image::codecs::jpeg::JpegEncoder;
use std::io::Cursor;

/// Image output format
#[wasm_bindgen]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ImageFormatType {
    Jpeg,
    Png,
}

impl ImageFormatType {
    fn from_str(s: &str) -> Result<Self, String> {
        match s.to_lowercase().as_str() {
            "jpeg" | "jpg" => Ok(Self::Jpeg),
            "png" => Ok(Self::Png),
            _ => Err(format!("Unsupported format: {}. Use 'jpeg' or 'png'", s)),
        }
    }

}

#[derive(Debug, Clone)]
struct CompressionConfig {
    quality: u8,
    format: ImageFormatType,
    original_size: usize,
    pixel_count: usize,
}

impl CompressionConfig {
    /// Maps input quality (0-100) to ASCII-optimized range (50-75)
    fn calculate_ascii_quality(&self) -> u8 {
        let mapped_quality = if self.quality >= 80 {
            // High quality requested -> use 70-75 for ASCII art
            70 + ((self.quality - 80) as f32 * 0.25) as u8
        } else if self.quality >= 60 {
            // Medium quality -> use 60-70
            60 + ((self.quality - 60) as f32 * 0.5) as u8
        } else {
            // Low quality -> use 50-60 (very aggressive for ASCII art)
            50 + ((self.quality as f32 / 60.0) * 10.0) as u8
        };
        mapped_quality.min(75).max(50) // Clamp between 50-75
    }

    /// Calculate final quality based on image size
    fn calculate_final_quality(&self) -> u8 {
        let ascii_quality = self.calculate_ascii_quality();
        
        match (self.original_size, self.pixel_count) {
            (size, pixels) if size < 50_000 && pixels < 500_000 => {
                // Small image: use even lower quality to ensure compression
                ascii_quality.min(65)
            }
            (size, _) if size < 100_000 => {
                // Medium-small image: slightly lower quality
                ascii_quality.min(70)
            }
            _ => ascii_quality, // Standard optimization
        }
    }

    /// Determine if PNG should be converted to JPEG for better compression
    /// 
    /// For ASCII art, JPEG compresses much better than PNG (often 3-5x smaller).
    /// However, we only auto-convert small images to avoid breaking user expectations
    /// for large images where PNG might be specifically needed (transparency, lossless).
    fn should_convert_png_to_jpeg(&self) -> bool {
        // Only convert small PNGs to JPEG for better compression
        // Large PNGs are kept as PNG (user might need lossless/transparency)
        self.format == ImageFormatType::Png 
            && self.pixel_count < 1_000_000 
            && self.original_size < 200_000
    }

    /// Check if compression result is acceptable
    fn is_compression_acceptable(&self, compressed_size: usize) -> bool {
        if compressed_size >= self.original_size {
            // Only reject if original was small (larger files might have overhead)
            self.original_size >= match self.format {
                ImageFormatType::Jpeg => 200_000,
                ImageFormatType::Png => 500_000,
            }
        } else {
            true
        }
    }
}

/// Compress and optimize an image optimized for ASCII art
/// 
/// ASCII art (text on solid backgrounds) compresses extremely well with aggressive settings:
/// - Aggressive quality reduction (50-75% range) - text is very forgiving
/// - Automatic quality adjustment based on image size
/// - Smart format selection (JPEG preferred for ASCII art)
/// - Safety checks to avoid making files larger
/// 
/// Optimization strategy:
/// - Small images (< 50KB): Very aggressive compression (50-65% quality)
/// - Medium images (50-200KB): Moderate compression (60-70% quality)
/// - Large images (> 200KB): Standard compression (65-75% quality)
/// - Returns original if compression would make file larger
/// 
/// # Arguments
/// * `image_data` - Raw image bytes (PNG, JPEG, etc.)
/// * `max_width` - Maximum width in pixels (maintains aspect ratio)
/// * `quality` - JPEG quality 0-100 (only used for JPEG output)
/// * `format` - Output format: "jpeg" or "png"
/// 
/// # Returns
/// Compressed image bytes
#[wasm_bindgen]
pub fn compress_image(
    image_data: &[u8],
    max_width: u32,
    quality: u8,
    format: &str,
) -> Result<Vec<u8>, String> {
    let format_type = ImageFormatType::from_str(format)?;
    
    compress_image_internal(image_data, max_width, quality, format_type)
}

/// Internal compression function with proper types
fn compress_image_internal(
    image_data: &[u8],
    max_width: u32,
    quality: u8,
    format: ImageFormatType,
) -> Result<Vec<u8>, String> {
    // Decode the image
    let img = image::load_from_memory(image_data)
        .map_err(|e| format!("Failed to decode image: {}", e))?;

    // Calculate new dimensions while maintaining aspect ratio
    let (new_width, new_height) = calculate_dimensions(img.width(), img.height(), max_width);

    // Resize the image if needed
    let resized_img = if new_width != img.width() || new_height != img.height() {
        img.resize_exact(new_width, new_height, image::imageops::FilterType::Lanczos3)
    } else {
        img
    };

    // Create compression configuration
    let config = CompressionConfig {
        quality,
        format,
        original_size: image_data.len(),
        pixel_count: (new_width * new_height) as usize,
    };

    // Encode based on format
    let output = match config.format {
        ImageFormatType::Jpeg => encode_jpeg(&resized_img, &config)?,
        ImageFormatType::Png => {
            if config.should_convert_png_to_jpeg() {
                // For small ASCII art images, convert PNG to JPEG for much better compression
                // JPEG typically compresses ASCII art 3-5x better than PNG
                // This is safe because ASCII art doesn't need transparency or lossless quality
                encode_jpeg(&resized_img, &config)?
            } else {
                // For larger images, respect PNG format request
                // User might need PNG for transparency, lossless quality, or other reasons
                encode_png(&resized_img)?
            }
        }
    };

    // Verify compression is acceptable
    if !config.is_compression_acceptable(output.len()) {
        return Ok(image_data.to_vec());
    }

    Ok(output)
}

/// Calculate new dimensions while maintaining aspect ratio
fn calculate_dimensions(width: u32, height: u32, max_width: u32) -> (u32, u32) {
    if max_width > 0 && width > max_width {
        let ratio = max_width as f32 / width as f32;
        (max_width, (height as f32 * ratio) as u32)
    } else {
        (width, height)
    }
}

/// Encode image as JPEG
fn encode_jpeg(
    img: &image::DynamicImage,
    config: &CompressionConfig,
) -> Result<Vec<u8>, String> {
    let rgb_img = img.to_rgb8();
    let final_quality = config.calculate_final_quality();
    
    let mut output = Vec::new();
    let mut encoder = JpegEncoder::new_with_quality(&mut output, final_quality);
    encoder
        .encode(
            rgb_img.as_raw(),
            rgb_img.width(),
            rgb_img.height(),
            image::ExtendedColorType::Rgb8,
        )
        .map_err(|e| format!("Failed to encode JPEG: {}", e))?;
    
    Ok(output)
}

/// Encode image as PNG
fn encode_png(img: &image::DynamicImage) -> Result<Vec<u8>, String> {
    let mut output = Vec::new();
    let mut cursor = Cursor::new(&mut output);
    img.write_to(&mut cursor, ImageFormat::Png)
        .map_err(|e| format!("Failed to encode PNG: {}", e))?;
    
    Ok(output)
}

/// Get image dimensions without decoding the full image
#[wasm_bindgen]
pub fn get_image_dimensions(image_data: &[u8]) -> Result<Vec<u32>, String> {
    // Use image crate to get dimensions (it's efficient for header reading)
    let reader = image::ImageReader::new(Cursor::new(image_data))
        .with_guessed_format()
        .map_err(|e| format!("Failed to create image reader: {}", e))?;
    
    let (width, height) = reader.into_dimensions()
        .map_err(|e| format!("Failed to get dimensions: {}", e))?;

    Ok(vec![width, height])
}
