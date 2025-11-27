use wasm_bindgen::prelude::*;

// Simple 5x7 bitmap font for ASCII art
// Each character is 5 wide x 7 tall
const CHAR_HEIGHT: usize = 7;

// Font data structure - stores character patterns
type CharPattern = [&'static str; CHAR_HEIGHT];

// Font data stored as a const array for better maintainability
// Format: (character, pattern)
const FONT_DATA: &[(&str, CharPattern)] = &[
    ("O", [
        " ### ",
        "#   #",
        "#   #",
        "#   #",
        "#   #",
        "#   #",
        " ### ",
    ]),
    (".", [
        "     ",
        "     ",
        "     ",
        "     ",
        "     ",
        "  #  ",
        "  #  ",
    ]),
    ("A", [
        "  #  ",
        " # # ",
        "#   #",
        "#####",
        "#   #",
        "#   #",
        "#   #",
    ]),
    ("S", [
        " ### ",
        "#   #",
        "#    ",
        " ### ",
        "    #",
        "#   #",
        " ### ",
    ]),
    ("C", [
        " ### ",
        "#   #",
        "#    ",
        "#    ",
        "#    ",
        "#   #",
        " ### ",
    ]),
    ("I", [
        "#####",
        "  #  ",
        "  #  ",
        "  #  ",
        "  #  ",
        "  #  ",
        "#####",
    ]),
    (" ", [
        "     ",
        "     ",
        "     ",
        "     ",
        "     ",
        "     ",
        "     ",
    ]),
    ("R", [
        "#### ",
        "#   #",
        "#   #",
        "#### ",
        "#  # ",
        "#   #",
        "#   #",
    ]),
    ("T", [
        "#####",
        "  #  ",
        "  #  ",
        "  #  ",
        "  #  ",
        "  #  ",
        "  #  ",
    ]),
    ("G", [
        " ### ",
        "#   #",
        "#    ",
        "#  ##",
        "#   #",
        "#   #",
        " ### ",
    ]),
    ("E", [
        "#####",
        "#    ",
        "#    ",
        "#### ",
        "#    ",
        "#    ",
        "#####",
    ]),
    ("N", [
        "#   #",
        "##  #",
        "# # #",
        "#  ##",
        "#   #",
        "#   #",
        "#   #",
    ]),
];

// Empty pattern for unknown characters
const EMPTY_PATTERN: CharPattern = [
    "     ",
    "     ",
    "     ",
    "     ",
    "     ",
    "     ",
    "     ",
];

// Get character pattern from font data
// Uses linear search - efficient for small font sets
fn get_char_pattern(c: char) -> CharPattern {
    let c_upper = c.to_ascii_uppercase();
    
    // Search through font data
    for (chars, pattern) in FONT_DATA {
        if chars.contains(c_upper) {
            return *pattern;
        }
    }
    
    EMPTY_PATTERN
}

/// Render text as ASCII art
fn render_ascii_text(text: &str) -> Vec<String> {
    let mut result = vec![String::new(); CHAR_HEIGHT];
    
    for c in text.chars() {
        let pattern = get_char_pattern(c);
        for (i, line) in pattern.iter().enumerate() {
            result[i].push_str(line);
            // Add spacing between characters
            result[i].push(' ');
        }
    }
    
    result
}

/// Generate ASCII art text centered in a grid
#[wasm_bindgen]
pub fn generate_text_in_center(text: &str, width: usize, height: usize) -> String {
    // Render the text as ASCII art
    let ascii_lines = render_ascii_text(text);
    let ascii_width = if !ascii_lines.is_empty() {
        ascii_lines[0].len()
    } else {
        0
    };
    let ascii_height = ascii_lines.len();
    
    // Calculate centering
    let horizontal_padding = if ascii_width < width {
        (width - ascii_width) / 2
    } else {
        0
    };
    
    let vertical_padding = if ascii_height < height {
        (height - ascii_height) / 2
    } else {
        0
    };
    
    let mut result = String::new();
    
    // Top padding
    for _ in 0..vertical_padding {
        for _ in 0..width {
            result.push(' ');
        }
        result.push('\n');
    }
    
    // ASCII art lines
    for line in &ascii_lines {
        // Left padding
        for _ in 0..horizontal_padding {
            result.push(' ');
        }
        
        // ASCII line (truncate if needed)
        let line_to_show = if line.len() > width - horizontal_padding {
            &line[..width - horizontal_padding]
        } else {
            line.as_str()
        };
        result.push_str(line_to_show);
        
        // Right padding
        let used = horizontal_padding + line_to_show.len();
        for _ in used..width {
            result.push(' ');
        }
        result.push('\n');
    }
    
    // Bottom padding
    let used_height = vertical_padding + ascii_height;
    for _ in used_height..height {
        for _ in 0..width {
            result.push(' ');
        }
        result.push('\n');
    }
    
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_text_in_center() {
        let text = "Hello, world!";
        let width = 10;
        let height = 10;
        let ascii = generate_text_in_center(text, width, height);
        assert_eq!(ascii, "Hello, world!\nHello, world!\nHello, world!\nHello, world!\nHello, world!\nHello, world!\nHello, world!\nHello, world!\nHello, world!\nHello, world!\n");
    }
}