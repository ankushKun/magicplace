fn generate_palette() -> [u32; 254] {
    let mut palette = [0u32; 254];
    let mut idx = 0;
    
    // 216 colors: 6×6×6 RGB cube
    let levels = [0x00, 0x33, 0x66, 0x99, 0xCC, 0xFF];
    for r in levels {
        for g in levels {
            for b in levels {
                palette[idx] = (r << 16) | (g << 8) | b;
                idx += 1;
            }
        }
    }
    
    // 24 grayscale (skipping 0x000000 and 0xFFFFFF, already in cube)
    for i in 1..=24 {
        let v = (i * 255) / 25; // ~10 apart
        if v != 0x00 && v != 0x33 && v != 0x66 && v != 0x99 && v != 0xCC && v != 0xFF {
            palette[idx] = (v << 16) | (v << 8) | v;
            idx += 1;
        }
    }
    
    // Fill remaining with useful in-betweens (skin tones, common UI colors, etc.)
    let extras = [
        0xFF6B6B, 0x4ECDC4, 0x45B7D1, 0x96CEB4, 0xFFA07A,
        0xDDA0DD, 0x20B2AA, 0x778899, 0xBC8F8F, 0xF0E68C,
        0xE6E6FA, 0xFFF0F5, 0x2F4F4F, 0x191970,
    ];
    for &color in &extras {
        if idx < 254 {
            palette[idx] = color;
            idx += 1;
        }
    }
    
    palette
}

fn main() {
    let palette = generate_palette();

    println!("Color Palette (254 colors arranged in gradient grid)\n");

    // Display RGB cube as 6 grids (one per red level), each 6×6
    println!("RGB Cube (216 colors):");
    for r_idx in 0..6 {
        println!("\nRed level {}/6:", r_idx + 1);
        for g_idx in 0..6 {
            for b_idx in 0..6 {
                let idx = r_idx * 36 + g_idx * 6 + b_idx;
                let color = palette[idx];
                let r = (color >> 16) & 0xFF;
                let g = (color >> 8) & 0xFF;
                let b = color & 0xFF;
                print!("\x1b[48;2;{};{};{}m   \x1b[0m", r, g, b);
            }
            println!();
        }
    }

    // Display grayscale as a single row
    println!("\nGrayscale ({}–{}):", 216, 216 + 24 - 1);
    for idx in 216..240 {
        let color = palette[idx];
        let r = (color >> 16) & 0xFF;
        let g = (color >> 8) & 0xFF;
        let b = color & 0xFF;
        print!("\x1b[48;2;{};{};{}m   \x1b[0m", r, g, b);
    }
    println!();

    // Display extras in rows of 7
    println!("\nExtra colors (240–253):");
    for idx in 240..254 {
        let color = palette[idx];
        let r = (color >> 16) & 0xFF;
        let g = (color >> 8) & 0xFF;
        let b = color & 0xFF;
        print!("\x1b[48;2;{};{};{}m   \x1b[0m", r, g, b);
        if (idx - 240 + 1) % 7 == 0 {
            println!();
        }
    }
    println!();
}