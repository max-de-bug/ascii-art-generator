use wasm_bindgen::prelude::*;

const PI: f64 = 3.14159265358979323846;
const RADIUS: usize = 10;
const WIDTH: usize = RADIUS * 4;
const HEIGHT: usize = RADIUS * 2;
const SHADE_CHARS: &[u8] = b".:-=+*#%@";
const NUM_SHADES: usize = 9;
const THICKNESS: f64 = 0.12; // Thickness in normalized coordinates (ensures continuous ring)

/// Calculate the radius at a given angle with organic undulations
/// The shape morphs as the animation angle changes, making it more dynamic
fn get_radius_at_angle(shape_theta: f64, animation_angle: f64) -> f64 {
    let base_radius = RADIUS as f64;
    // Create more subtle organic undulations for a more circular shape
    // The undulations phase-shift with animation angle, causing the shape to morph
    let undulation1 = (shape_theta * 3.0 + animation_angle * 0.5).sin() * 0.15;
    let undulation2 = (shape_theta * 5.0 + animation_angle * 0.8).sin() * 0.12;
    let undulation3 = (shape_theta * 7.0 + animation_angle * 1.2).sin() * 0.08;
    let undulation4 = (shape_theta * 11.0 + animation_angle * 0.3).sin() * 0.05;
    
    // Add a subtle overall morphing effect based on animation angle
    let morph_factor = (animation_angle * 2.0).sin() * 0.1;
    
    base_radius + undulation1 + undulation2 + undulation3 + undulation4 + morph_factor
}

/// Generate a single frame of the animated organic circle
/// Returns the ASCII art string for the current frame
#[wasm_bindgen]
pub fn generate_sphere_frame(angle: f64) -> String {
    let mut grid = vec![vec![b' '; WIDTH]; HEIGHT];
    
    // Calculate light direction (rotating light source, matching C code)
    let lx = angle.cos();
    let ly = angle.sin() * 0.5;
    let lz = -0.7;
    let l_norm = (lx * lx + ly * ly + lz * lz).sqrt();
    
    let (lx_norm, ly_norm, lz_norm) = if l_norm != 0.0 {
        (lx / l_norm, ly / l_norm, lz / l_norm)
    } else {
        (lx, ly, lz)
    };
    
    // Iterate over all pixels to ensure continuous coverage without gaps
    // This approach checks every pixel, preventing any breaks in the circle
    for y in 0..HEIGHT {
        for x in 0..WIDTH {
            // Convert screen coordinates to normalized coordinates [-1, 1]
            // Matching C code: sx = RADIUS * (x_norm + 1.0) * 2, so x_norm = sx / (RADIUS * 2) - 1.0
            let x_norm = (x as f64 / ((RADIUS as f64) * 2.0)) - 1.0;
            let y_norm = (y as f64 / (RADIUS as f64)) - 1.0;
            
            // Calculate distance from center and angle
            let distance = (x_norm * x_norm + y_norm * y_norm).sqrt();
            let screen_theta = y_norm.atan2(x_norm);
            
            // Rotate the shape by subtracting the animation angle
            // This makes the circle rotate around its center
            let shape_theta = screen_theta - angle;
            
            // Get the expected radius at this angle (with organic undulations that morph)
            let expected_radius = get_radius_at_angle(shape_theta, angle);
            
            // Convert expected radius to normalized coordinates
            // The radius is in screen units (0 to ~RADIUS*2), normalize to match x_norm/y_norm scale
            // Since x_norm goes from -1 to 1 (width 2), and radius is in [0, RADIUS*2] range
            // We need to scale: expected_radius_norm = expected_radius / RADIUS
            let expected_radius_norm = expected_radius / (RADIUS as f64);
            
            // Check if pixel is within the thick ring (distance matches expected radius ± thickness)
            let dist_from_ring = (distance - expected_radius_norm).abs();
            
            if dist_from_ring <= THICKNESS {
                // Calculate shading based on the shape's rotated angle relative to light source
                // The normal of the circle at this point points outward
                let normal_x = shape_theta.cos();
                let normal_y = shape_theta.sin();
                let normal_z = 0.0; // 2D circle
                
                // Dot product with light direction for shading
                let dot = normal_x * lx_norm + normal_y * ly_norm + normal_z * lz_norm;
                
                // Clamp to [0, 1]
                let dot_clamped = dot.max(0.0);
                
                // Map to shade character index
                let shade_index = ((dot_clamped * NUM_SHADES as f64) as usize).min(NUM_SHADES - 1);
                
                grid[y][x] = SHADE_CHARS[shade_index];
            }
        }
    }
    
    // Convert grid to string
    let mut result = String::new();
    for row in grid.iter() {
        let row_str = String::from_utf8_lossy(row);
        result.push_str(&row_str);
        result.push('\n');
    }
    
    result
}

