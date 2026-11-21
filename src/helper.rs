/// Escape control characters in configuration and error messages.
pub fn escape_terminal_controls(text: &str) -> String {
    let mut safe = String::new();
    for ch in text.chars() {
        if ch.is_control() && ch != '\n' && ch != '\t' {
            safe.extend(ch.escape_default());
        } else {
            safe.push(ch);
        }
    }
    safe
}

#[cfg(test)]
mod tests {
    use super::escape_terminal_controls;

    #[test]
    fn preserves_readable_text_and_escapes_terminal_controls() {
        assert_eq!(
            escape_terminal_controls("Hello 世界 🦀\n\tcode\0\x07\x08\r\x1b[2J\x7f\u{009b}2J"),
            "Hello 世界 🦀\n\tcode\\u{0}\\u{7}\\u{8}\\r\\u{1b}[2J\\u{7f}\\u{9b}2J"
        );
    }
}
