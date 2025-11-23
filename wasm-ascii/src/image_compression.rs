use wasm_bindgen::prelude::*;
use image::{ImageFormat};
use image::codecs::jpeg::JpegEncoder;
use std::io::Cursor;

/// Compress and optimize an image optimized for ASCII art
/// Since all images are ASCII art, applies specific optimizations:
/// - Slightly lower quality (text is more forgiving of compression)
/// - JPEG format recommended (better compression for text on solid backgrounds)
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
    // Decode the image
    let img = image::load_from_memory(image_data)
        .map_err(|e| format!("Failed to decode image: {}", e))?;

    // Calculate new dimensions while maintaining aspect ratio
    let width = img.width();
    let height = img.height();
    let (new_width, new_height) = if max_width > 0 && width > max_width {
        let ratio = max_width as f32 / width as f32;
        (max_width, (height as f32 * ratio) as u32)
    } else {
        (width, height)
    };

    // Resize the image if needed
    let resized_img = if new_width != width || new_height != height {
        img.resize_exact(new_width, new_height, image::imageops::FilterType::Lanczos3)
    } else {
        img
    };

    // ASCII art optimization strategy:
    // 1. Use slightly lower quality (90% of requested, minimum 70%)
    //    Text is more forgiving of compression artifacts than photos
    // 2. Ensure quality is never too low to maintain readability
    let ascii_quality = ((quality as f32 * 0.9).max(70.0) as u8).min(quality);

    // Encode based on format
    let mut output = Vec::new();
    match format.to_lowercase().as_str() {
        "jpeg" | "jpg" => {
            // Convert to RGB8 if needed (JPEG doesn't support alpha)
            let rgb_img = resized_img.to_rgb8();

            // Encode as JPEG with quality control
            let mut encoder = JpegEncoder::new_with_quality(&mut output, ascii_quality);
            encoder
                .encode(
                    rgb_img.as_raw(),
                    rgb_img.width(),
                    rgb_img.height(),
                    image::ExtendedColorType::Rgb8,
                )
                .map_err(|e| format!("Failed to encode JPEG: {}", e))?;
        }
        "png" => {
            // PNG encoding (quality parameter is ignored for PNG)
            // Use Cursor to provide Write + Seek trait
            let mut cursor = Cursor::new(&mut output);
            resized_img
                .write_to(&mut cursor, ImageFormat::Png)
                .map_err(|e| format!("Failed to encode PNG: {}", e))?;
        }
        _ => return Err(format!("Unsupported format: {}. Use 'jpeg' or 'png'", format)),
    }

    Ok(output)
}

/// Get image dimensions without decoding the full image
#[wasm_bindgen]
pub fn get_image_dimensions(image_data: &[u8]) -> Result<Vec<u32>, String> {
    // Use image crate to get dimensions (it's efficient for header reading)
    let reader = image::io::Reader::new(Cursor::new(image_data))
        .with_guessed_format()
        .map_err(|e| format!("Failed to create image reader: {}", e))?;
    
    let (width, height) = reader.into_dimensions()
        .map_err(|e| format!("Failed to get dimensions: {}", e))?;

    Ok(vec![width, height])
}
