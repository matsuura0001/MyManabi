//! Answer-candidate expansion rules.
//!
//! Each rule inspects a single answer value and produces alternative forms
//! the human reviewer can pick from. The original value is never replaced
//! automatically — the reviewer selects canonical + accepted answers.

use serde::Serialize;

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExpansionCandidate {
    pub value: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AnswerExpansionOutcome {
    pub rule_id: String,
    pub rule_name: String,
    pub rule_description: String,
    pub original_value: String,
    pub candidates: Vec<ExpansionCandidate>,
}

/// Run all built-in expansion rules against `value`.
/// Returns one outcome per matched rule (typically 0 or more).
pub fn apply_expansion_rules(value: &str) -> Vec<AnswerExpansionOutcome> {
    let mut outcomes = Vec::new();

    if let Some(candidates) = detect_remainder_r(value) {
        outcomes.push(AnswerExpansionOutcome {
            rule_id: "remainder-r-to-japanese".to_owned(),
            rule_name: "英語式の余り表記を日本語化".to_owned(),
            rule_description:
                "「N r M」形式の余り表記を「N あまり M」「N 余り M」に変換します。"
                    .to_owned(),
            original_value: value.to_owned(),
            candidates,
        });
    }

    if let Some(candidates) = detect_fraction(value) {
        outcomes.push(AnswerExpansionOutcome {
            rule_id: "fraction-to-japanese".to_owned(),
            rule_name: "分数を日本語化".to_owned(),
            rule_description:
                "「N/M」形式の分数を「M分のN」に変換します。混合数「A N/M」は「AとM分のN」になります。"
                    .to_owned(),
            original_value: value.to_owned(),
            candidates,
        });
    }

    if let Some(candidates) = detect_trailing_zero_decimal(value) {
        outcomes.push(AnswerExpansionOutcome {
            rule_id: "trailing-zero-decimal".to_owned(),
            rule_name: "末尾ゼロの小数を整数化".to_owned(),
            rule_description: "「3.0」「5.00」のように小数部がゼロの値を整数に変換します。"
                .to_owned(),
            original_value: value.to_owned(),
            candidates,
        });
    }

    outcomes
}

// ---- rule: remainder "N r M" → "N あまり M" / "N 余り M" ----

fn detect_remainder_r(value: &str) -> Option<Vec<ExpansionCandidate>> {
    let chars: Vec<char> = value.chars().collect();
    let n = chars.len();

    for i in 0..n {
        if chars[i] != 'r' && chars[i] != 'R' {
            continue;
        }

        // Scan backward past optional spaces to find preceding digits.
        let mut j = i;
        while j > 0 && chars[j - 1] == ' ' {
            j -= 1;
        }
        if j == 0 || !chars[j - 1].is_ascii_digit() {
            continue;
        }
        let q_end = j; // exclusive
        while j > 0 && chars[j - 1].is_ascii_digit() {
            j -= 1;
        }
        let q_start = j;

        // Guard: 'r' must not be part of a longer alphabetic run before the digits.
        if q_start > 0 && chars[q_start - 1].is_alphabetic() {
            continue;
        }

        // Scan forward past optional spaces to find following digits.
        let mut k = i + 1;
        while k < n && chars[k] == ' ' {
            k += 1;
        }
        if k >= n || !chars[k].is_ascii_digit() {
            continue;
        }
        let r_start = k;
        while k < n && chars[k].is_ascii_digit() {
            k += 1;
        }
        let r_end = k;

        // Guard: 'r' must not be part of a longer alphabetic run after the digits.
        if r_end < n && chars[r_end].is_alphabetic() {
            continue;
        }

        let prefix: String = chars[..q_start].iter().collect();
        let quotient: String = chars[q_start..q_end].iter().collect();
        let remainder: String = chars[r_start..r_end].iter().collect();
        let suffix: String = chars[r_end..].iter().collect();

        return Some(vec![
            ExpansionCandidate {
                value: format!("{}{} あまり {}{}", prefix, quotient, remainder, suffix),
            },
            ExpansionCandidate {
                value: format!("{}{} 余り {}{}", prefix, quotient, remainder, suffix),
            },
        ]);
    }

    None
}

// ---- rule: simple fraction "N/M" → "M分のN", mixed "A N/M" → "AとM分のN" ----

fn detect_fraction(value: &str) -> Option<Vec<ExpansionCandidate>> {
    let chars: Vec<char> = value.chars().collect();
    let n = chars.len();

    for i in 0..n {
        if chars[i] != '/' {
            continue;
        }

        // Scan backward past optional spaces to find the numerator.
        let mut j = i;
        while j > 0 && chars[j - 1] == ' ' {
            j -= 1;
        }
        if j == 0 || !chars[j - 1].is_ascii_digit() {
            continue;
        }
        let num_end = j;
        while j > 0 && chars[j - 1].is_ascii_digit() {
            j -= 1;
        }
        let num_start = j;

        // Guard: reject http:// style or letter-prefixed slashes.
        if num_start > 0
            && (chars[num_start - 1] == '/' || chars[num_start - 1].is_alphabetic())
        {
            continue;
        }

        // Scan forward past optional spaces to find the denominator.
        let mut k = i + 1;
        while k < n && chars[k] == ' ' {
            k += 1;
        }
        if k >= n || !chars[k].is_ascii_digit() {
            continue;
        }
        let den_start = k;
        while k < n && chars[k].is_ascii_digit() {
            k += 1;
        }
        let den_end = k;

        // Guard: reject trailing slash chains or word characters.
        if den_end < n && (chars[den_end] == '/' || chars[den_end].is_alphabetic()) {
            continue;
        }

        let numerator: String = chars[num_start..num_end].iter().collect();
        let denominator: String = chars[den_start..den_end].iter().collect();

        // Reject large numbers that look like date components (year/month/day).
        let n_val: u32 = numerator.parse().unwrap_or(0);
        let d_val: u32 = denominator.parse().unwrap_or(0);
        if n_val >= 100 || d_val >= 100 || d_val == 0 {
            continue;
        }

        // Check for mixed number: integer immediately before the numerator, separated
        // by one space — e.g. "2 1/2".
        let prefix_raw: String = chars[..num_start].iter().collect();
        let prefix_trimmed = prefix_raw.trim_end();
        let last_is_digit = prefix_trimmed
            .chars()
            .last()
            .map(|c| c.is_ascii_digit())
            .unwrap_or(false);

        let suffix: String = chars[den_end..].iter().collect();

        if last_is_digit {
            // Extract the whole-number part.
            let int_end = prefix_trimmed.len();
            let int_start = prefix_trimmed
                .char_indices()
                .rev()
                .find(|(_, c)| !c.is_ascii_digit())
                .map(|(i, _)| i + prefix_trimmed[..=i].chars().last().map_or(0, |c| c.len_utf8()))
                .unwrap_or(0);
            let before_int = &prefix_trimmed[..int_start];
            let integer_part = &prefix_trimmed[int_start..int_end];
            return Some(vec![ExpansionCandidate {
                value: format!(
                    "{}{}と{}分の{}{}",
                    before_int, integer_part, denominator, numerator, suffix
                ),
            }]);
        }

        return Some(vec![ExpansionCandidate {
            value: format!("{}{}分の{}{}", prefix_raw, denominator, numerator, suffix),
        }]);
    }

    None
}

// ---- rule: trailing-zero decimal "3.0" → "3" ----

fn detect_trailing_zero_decimal(value: &str) -> Option<Vec<ExpansionCandidate>> {
    let chars: Vec<char> = value.chars().collect();
    let n = chars.len();

    for i in 0..n {
        if chars[i] != '.' {
            continue;
        }

        // Must be preceded by a digit.
        if i == 0 || !chars[i - 1].is_ascii_digit() {
            continue;
        }

        // All characters after the dot must be '0' (at least one), nothing else.
        let frac_start = i + 1;
        if frac_start >= n || !chars[frac_start..].iter().all(|&c| c == '0') || chars[frac_start..].is_empty() {
            continue;
        }

        // Find start of the integer part.
        let int_end = i;
        let mut int_start = int_end;
        while int_start > 0 && chars[int_start - 1].is_ascii_digit() {
            int_start -= 1;
        }

        let prefix: String = chars[..int_start].iter().collect();
        let integer: String = chars[int_start..int_end].iter().collect();

        return Some(vec![ExpansionCandidate {
            value: format!("{}{}", prefix, integer),
        }]);
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn remainder_basic() {
        let out = apply_expansion_rules("150 r 1");
        assert_eq!(out.len(), 1);
        let rule = &out[0];
        assert_eq!(rule.rule_id, "remainder-r-to-japanese");
        assert_eq!(rule.candidates[0].value, "150 あまり 1");
        assert_eq!(rule.candidates[1].value, "150 余り 1");
    }

    #[test]
    fn remainder_no_spaces() {
        let out = apply_expansion_rules("150r1");
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].candidates[0].value, "150 あまり 1");
    }

    #[test]
    fn remainder_uppercase_r() {
        let out = apply_expansion_rules("150 R 2");
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].candidates[0].value, "150 あまり 2");
    }

    #[test]
    fn no_match_word_remainder() {
        // "from" contains 'r' but not surrounded by digits
        let out = apply_expansion_rules("from 150");
        assert_eq!(out.len(), 0);
    }

    #[test]
    fn no_match_plain_number() {
        let out = apply_expansion_rules("150");
        assert_eq!(out.len(), 0);
    }

    #[test]
    fn no_match_japanese() {
        let out = apply_expansion_rules("150 あまり 1");
        assert_eq!(out.len(), 0);
    }

    // ---- fraction tests ----

    #[test]
    fn fraction_simple() {
        let out = apply_expansion_rules("1/2");
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].rule_id, "fraction-to-japanese");
        assert_eq!(out[0].candidates[0].value, "2分の1");
    }

    #[test]
    fn fraction_improper() {
        let out = apply_expansion_rules("7/3");
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].candidates[0].value, "3分の7");
    }

    #[test]
    fn fraction_mixed() {
        let out = apply_expansion_rules("2 1/4");
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].candidates[0].value, "2と4分の1");
    }

    #[test]
    fn fraction_no_match_date() {
        // Four-digit year → rejected by >= 100 guard
        let out = apply_expansion_rules("2024/1");
        assert_eq!(out.len(), 0);
    }

    #[test]
    fn fraction_no_match_url() {
        let out = apply_expansion_rules("http://example.com");
        assert_eq!(out.len(), 0);
    }

    #[test]
    fn fraction_already_japanese() {
        let out = apply_expansion_rules("4分の3");
        assert_eq!(out.len(), 0);
    }

    // ---- trailing-zero decimal tests ----

    #[test]
    fn decimal_single_zero() {
        let out = apply_expansion_rules("3.0");
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].rule_id, "trailing-zero-decimal");
        assert_eq!(out[0].candidates[0].value, "3");
    }

    #[test]
    fn decimal_multiple_zeros() {
        let out = apply_expansion_rules("5.00");
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].candidates[0].value, "5");
    }

    #[test]
    fn decimal_no_match_nonzero() {
        // 3.14 has non-zero fractional part → no match
        let out = apply_expansion_rules("3.14");
        assert_eq!(out.len(), 0);
    }

    #[test]
    fn decimal_no_match_plain() {
        let out = apply_expansion_rules("3");
        assert_eq!(out.len(), 0);
    }
}
