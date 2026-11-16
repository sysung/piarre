/// Preserve readable text while making terminal control bytes inert.
/// Each character is independent, so splitting an escape sequence across
/// model chunks cannot bypass filtering.
pub fn safe_text(text: &str) -> String {
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
    use super::safe_text;

    #[test]
    fn preserves_readable_unicode_and_layout() {
        assert_eq!(safe_text("Hello 世界 🦀\n\tcode"), "Hello 世界 🦀\n\tcode");
    }

    #[test]
    fn neutralizes_every_terminal_control_except_tab_and_newline() {
        for value in (0..=0x1f).chain(0x7f..=0x9f) {
            let ch = char::from_u32(value).unwrap();
            let output = safe_text(&ch.to_string());
            if ch != '\n' && ch != '\t' {
                assert!(!output.chars().any(char::is_control), "{value:x}");
                assert!(!output.is_empty());
            }
        }
    }

    #[test]
    fn split_sequences_never_reach_the_terminal_as_controls() {
        let text = "before\x1b[2J\x1b[H\x1b]52;c;YWJj\x07\r\x08after\u{009b}2J";
        let expected = safe_text(text);
        for split in text.char_indices().map(|(i, _)| i).chain([text.len()]) {
            assert_eq!(safe_text(&text[..split]) + &safe_text(&text[split..]), expected);
        }
        assert!(!expected.chars().any(char::is_control));
        assert!(expected.contains("before"));
        assert!(expected.ends_with("2J"));
    }
}
