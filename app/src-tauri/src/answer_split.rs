use crate::codex::ProposedItem;
use serde::Serialize;

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RuleSplitCandidate {
    pub rule_id: String,
    pub rule_name: String,
    pub rule_description: String,
    /// "builtin" | "custom" | "ai-generated"
    pub source: String,
    pub items: Vec<ProposedItem>,
    pub unassigned_text: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalSplitOutcome {
    pub candidates: Vec<RuleSplitCandidate>,
}

// ---- normalization helpers (detection only, not output) ----

fn to_ascii_digit(c: char) -> Option<char> {
    // full-width 0-9 → half-width
    if ('０'..='９').contains(&c) {
        Some((b'0' + (c as u8 - '０' as u8)) as char)
    } else if c.is_ascii_digit() {
        Some(c)
    } else {
        None
    }
}

// ---- marker finders ----

/// ①②③...⑳ and ❶❷...❿
fn find_circled_number_markers(text: &str) -> Vec<(String, usize)> {
    let mut markers = Vec::new();
    for (byte_off, ch) in text.char_indices() {
        if matches!(ch, '①'..='⑳' | '❶'..='❿') {
            markers.push((ch.to_string(), byte_off));
        }
    }
    markers
}

/// (1)(2)(3) or （1）（2）（3） — ASCII or full-width parens around digits
fn find_parenthesized_number_markers(text: &str) -> Vec<(String, usize)> {
    let chars: Vec<(usize, char)> = text.char_indices().collect();
    let mut markers = Vec::new();
    let mut i = 0;
    while i < chars.len() {
        let (byte_off, ch) = chars[i];
        let close = match ch {
            '(' => ')',
            '（' => '）',
            _ => {
                i += 1;
                continue;
            }
        };
        let mut j = i + 1;
        let mut digit_count = 0;
        while j < chars.len() && to_ascii_digit(chars[j].1).is_some() {
            digit_count += 1;
            j += 1;
        }
        if digit_count > 0 && j < chars.len() && chars[j].1 == close {
            let end_byte = chars[j].0 + chars[j].1.len_utf8();
            markers.push((text[byte_off..end_byte].to_owned(), byte_off));
            i = j + 1;
        } else {
            i += 1;
        }
    }
    markers
}

/// 問1 問2 問3 — also handles full-width digits (問１ 問２)
fn find_question_number_markers(text: &str) -> Vec<(String, usize)> {
    let chars: Vec<(usize, char)> = text.char_indices().collect();
    let mut markers = Vec::new();
    let mut i = 0;
    while i < chars.len() {
        let (byte_off, ch) = chars[i];
        if ch == '問' {
            let mut j = i + 1;
            while j < chars.len() && to_ascii_digit(chars[j].1).is_some() {
                j += 1;
            }
            if j > i + 1 {
                let last = &chars[j - 1];
                let end_byte = last.0 + last.1.len_utf8();
                markers.push((text[byte_off..end_byte].to_owned(), byte_off));
                i = j;
                continue;
            }
        }
        i += 1;
    }
    markers
}

/// ア イ ウ エ オ ... (katakana used as numbered labels).
/// Only matches if the katakana appears in order starting from ア and is
/// followed by a separator char or a value-like char (not more katakana from the sequence).
fn find_katakana_sequence_markers(text: &str) -> Vec<(String, usize)> {
    const SEQ: &[char] = &[
        'ア', 'イ', 'ウ', 'エ', 'オ', 'カ', 'キ', 'ク', 'ケ', 'コ',
        'サ', 'シ', 'ス', 'セ', 'ソ', 'タ', 'チ', 'ツ', 'テ', 'ト',
    ];
    let chars: Vec<(usize, char)> = text.char_indices().collect();
    let mut markers: Vec<(String, usize)> = Vec::new();
    let mut expected = 0;
    let mut i = 0;
    while i < chars.len() {
        let (byte_off, ch) = chars[i];
        if expected < SEQ.len() && ch == SEQ[expected] {
            // accept if followed by separator or value char (not the next katakana in seq)
            let after = chars.get(i + 1).map(|&(_, c)| c);
            let looks_like_label = match after {
                None => true,
                Some(c) => {
                    matches!(c, ' ' | '　' | ':' | '：' | '\n' | '\r')
                        || c.is_ascii_digit()
                        || ('０'..='９').contains(&c)
                        || c.is_alphabetic()
                }
            };
            if looks_like_label {
                markers.push((ch.to_string(), byte_off));
                expected += 1;
            }
        }
        i += 1;
    }
    if markers.len() >= 2 {
        markers
    } else {
        Vec::new()
    }
}

/// 1. 2. 3. or 1、2、3 — digit followed by period/Japanese stop/Japanese comma
/// Only count when preceded by whitespace, start-of-string, or a previous value end.
fn find_dot_number_markers(text: &str) -> Vec<(String, usize)> {
    let chars: Vec<(usize, char)> = text.char_indices().collect();
    let mut markers = Vec::new();
    let mut i = 0;
    while i < chars.len() {
        let (byte_off, ch) = chars[i];
        if to_ascii_digit(ch).is_some() {
            // Must be preceded by whitespace, start, or newline
            let preceded_ok = if i == 0 {
                true
            } else {
                matches!(chars[i - 1].1, ' ' | '　' | '\n' | '\r')
            };
            if preceded_ok {
                let mut j = i + 1;
                while j < chars.len() && to_ascii_digit(chars[j].1).is_some() {
                    j += 1;
                }
                if j < chars.len() && matches!(chars[j].1, '.' | '．' | '、' | '，') {
                    let end_byte = chars[j].0 + chars[j].1.len_utf8();
                    markers.push((text[byte_off..end_byte].to_owned(), byte_off));
                    i = j + 1;
                    continue;
                }
            }
        }
        i += 1;
    }
    markers
}

// ---- equation-answer extraction ----

/// If `s` contains `=` (ASCII) or `＝` (full-width), return the trimmed part after it.
fn strip_after_equals(s: &str) -> Option<&str> {
    let (pos, eq_len) = if let Some(p) = s.find('=') {
        (p, 1usize)
    } else if let Some(p) = s.find('＝') {
        (p, '＝'.len_utf8())
    } else {
        return None;
    };
    let after = s[pos + eq_len..].trim();
    if after.is_empty() { None } else { Some(after) }
}

/// If every item's value contains `=`, return a new candidate with only the right-hand side.
fn make_equation_answer_variant(cand: &RuleSplitCandidate) -> Option<RuleSplitCandidate> {
    if cand.items.is_empty() || !cand.items.iter().all(|item| item.value.contains('=') || item.value.contains('＝')) {
        return None;
    }
    let items: Vec<ProposedItem> = cand
        .items
        .iter()
        .map(|item| ProposedItem {
            label: item.label.clone(),
            value: strip_after_equals(&item.value)
                .unwrap_or(&item.value)
                .to_owned(),
            confidence: item.confidence,
        })
        .collect();
    if items.iter().any(|item| item.value.is_empty()) {
        return None;
    }
    Some(RuleSplitCandidate {
        rule_id: format!("{}-equation-answer", cand.rule_id),
        rule_name: format!("{}（答えのみ）", cand.rule_name),
        rule_description: "式 = 答え の形式から答え部分だけを抽出します".to_owned(),
        source: cand.source.clone(),
        items,
        unassigned_text: cand.unassigned_text.clone(),
    })
}

// ---- split engine ----

fn split_by_markers(text: &str, markers: &[(String, usize)]) -> (Vec<ProposedItem>, String) {
    if markers.is_empty() {
        return (Vec::new(), String::new());
    }
    let unassigned = text[..markers[0].1].trim().to_owned();
    let mut items = Vec::new();
    for (i, (label, label_start)) in markers.iter().enumerate() {
        let value_start = label_start + label.len();
        let value_end = if i + 1 < markers.len() {
            markers[i + 1].1
        } else {
            text.len()
        };
        let value = text[value_start..value_end]
            .trim()
            .trim_end_matches(|c| matches!(c, '、' | '，' | ',' | '・'))
            .trim()
            .to_owned();
        items.push(ProposedItem {
            label: label.clone(),
            value,
            confidence: 0.9,
        });
    }
    (items, unassigned)
}

fn try_newline_split(text: &str) -> Option<RuleSplitCandidate> {
    let lines: Vec<&str> = text
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty())
        .collect();
    if lines.len() < 2 {
        return None;
    }
    let items = lines
        .iter()
        .enumerate()
        .map(|(i, &line)| ProposedItem {
            label: format!("問{}", i + 1),
            value: line.to_owned(),
            confidence: 0.5,
        })
        .collect();
    Some(RuleSplitCandidate {
        rule_id: "newline-separated".to_owned(),
        rule_name: "改行で分割".to_owned(),
        rule_description: "改行ごとに1つの答えとして分割します".to_owned(),
        source: "builtin".to_owned(),
        items,
        unassigned_text: String::new(),
    })
}

// ---- public API ----

pub fn apply_local_split_rules(text: &str) -> LocalSplitOutcome {
    let mut raw: Vec<RuleSplitCandidate> = Vec::new();

    macro_rules! try_rule {
        ($find:expr, $id:expr, $name:expr, $desc:expr) => {{
            let markers = $find;
            if markers.len() >= 2 {
                let (items, unassigned) = split_by_markers(text, &markers);
                raw.push(RuleSplitCandidate {
                    rule_id: $id.to_owned(),
                    rule_name: $name.to_owned(),
                    rule_description: $desc.to_owned(),
                    source: "builtin".to_owned(),
                    items,
                    unassigned_text: unassigned,
                });
            }
        }};
    }

    try_rule!(
        find_circled_number_markers(text),
        "circled-number",
        "丸数字で分割",
        "①②③ のような丸数字を見つけて分割します"
    );
    try_rule!(
        find_parenthesized_number_markers(text),
        "parenthesized-number",
        "括弧付き数字で分割",
        "(1)(2)(3) のような括弧数字を見つけて分割します"
    );
    try_rule!(
        find_question_number_markers(text),
        "question-number",
        "問番号で分割",
        "問1・問2・問3 のような問番号を見つけて分割します"
    );
    try_rule!(
        find_katakana_sequence_markers(text),
        "katakana-sequence",
        "カタカナ連番で分割",
        "ア・イ・ウ のような連番カタカナを見つけて分割します"
    );
    try_rule!(
        find_dot_number_markers(text),
        "dot-number",
        "番号ピリオドで分割",
        "1. 2. 3. のような番号ピリオドを見つけて分割します"
    );

    // Newline fallback
    if let Some(mut c) = try_newline_split(text) {
        let already_covered = raw.iter().any(|cand| cand.items.len() == c.items.len());
        if !already_covered {
            c.source = "builtin".to_owned();
            raw.push(c);
        }
    }

    // Post-process: for any candidate where every value contains '=',
    // insert an answer-only variant immediately before the full-equation variant.
    let mut candidates = Vec::with_capacity(raw.len() * 2);
    for cand in raw {
        if let Some(eq_variant) = make_equation_answer_variant(&cand) {
            candidates.push(eq_variant);
        }
        candidates.push(cand);
    }

    LocalSplitOutcome { candidates }
}

// ---- tests ----

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn circled_numbers_split() {
        let outcome = apply_local_split_rules("① 12 ② 15 ③ 18");
        let cand = outcome.candidates.iter().find(|c| c.rule_id == "circled-number");
        assert!(cand.is_some(), "should have circled-number candidate");
        let items = &cand.unwrap().items;
        assert_eq!(items.len(), 3);
        assert_eq!(items[0].value, "12");
        assert_eq!(items[1].value, "15");
        assert_eq!(items[2].value, "18");
    }

    #[test]
    fn parenthesized_numbers_split() {
        let outcome = apply_local_split_rules("(1) 3cm (2) 4cm");
        let cand = outcome.candidates.iter().find(|c| c.rule_id == "parenthesized-number");
        assert!(cand.is_some());
        let items = &cand.unwrap().items;
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].value, "3cm");
        assert_eq!(items[1].value, "4cm");
    }

    #[test]
    fn question_number_split() {
        let outcome = apply_local_split_rules("問1 90° 問2 45° 問3 30°");
        let cand = outcome.candidates.iter().find(|c| c.rule_id == "question-number");
        assert!(cand.is_some());
        let items = &cand.unwrap().items;
        assert_eq!(items.len(), 3);
        assert_eq!(items[0].value, "90°");
    }

    #[test]
    fn full_width_parens_split() {
        let outcome = apply_local_split_rules("（1）たし算 （2）ひき算");
        let cand = outcome.candidates.iter().find(|c| c.rule_id == "parenthesized-number");
        assert!(cand.is_some());
    }

    #[test]
    fn no_match_returns_newline_fallback() {
        let outcome = apply_local_split_rules("90°\n45°");
        assert!(!outcome.candidates.is_empty());
        assert_eq!(outcome.candidates[0].rule_id, "newline-separated");
    }

    #[test]
    fn single_value_returns_empty_candidates() {
        let outcome = apply_local_split_rules("42");
        assert!(outcome.candidates.is_empty());
    }

    #[test]
    fn dot_number_equation_answer_extraction() {
        let text = "1. 452 ÷ 3 = 150 r 2\n2. 763 ÷ 4 = 190 r 3\n3. 800 ÷ 5 = 160";
        let outcome = apply_local_split_rules(text);
        // Answer-only variant should exist
        let eq_cand = outcome.candidates.iter().find(|c| c.rule_id == "dot-number-equation-answer");
        assert!(eq_cand.is_some(), "should have dot-number-equation-answer candidate");
        let items = &eq_cand.unwrap().items;
        assert_eq!(items.len(), 3);
        assert_eq!(items[0].value, "150 r 2");
        assert_eq!(items[1].value, "190 r 3");
        assert_eq!(items[2].value, "160");
    }

    #[test]
    fn ten_item_division_worksheet() {
        let text = "1. 452 ÷ 3 = 150 r 2\n2. 763 ÷ 4 = 190 r 3\n3. 846 ÷ 7 = 120 r 6\n\
                    4. 800 ÷ 5 = 160\n5. 981 ÷ 2 = 490 r 1\n6. 401 ÷ 4 = 100 r 1\n\
                    7. 807 ÷ 8 = 100 r 7\n8. 603 ÷ 6 = 100 r 3\n9. 602 ÷ 3 = 200 r 2\n\
                    10. 901 ÷ 9 = 100 r 1";
        let outcome = apply_local_split_rules(text);
        let cand = outcome
            .candidates
            .iter()
            .find(|c| c.rule_id == "dot-number-equation-answer")
            .expect("should have equation-answer candidate");
        assert_eq!(cand.items.len(), 10, "should have 10 items");
        assert_eq!(cand.items[0].label, "1.");
        assert_eq!(cand.items[0].value, "150 r 2");
        assert_eq!(cand.items[3].value, "160");   // no remainder
        assert_eq!(cand.items[9].label, "10.");
        assert_eq!(cand.items[9].value, "100 r 1");
        // Answer-only variant should appear BEFORE full-equation variant in candidates
        let eq_pos = outcome.candidates.iter().position(|c| c.rule_id == "dot-number-equation-answer").unwrap();
        let full_pos = outcome.candidates.iter().position(|c| c.rule_id == "dot-number").unwrap();
        assert!(eq_pos < full_pos, "answer-only variant should precede full-equation variant");
    }

    #[test]
    fn equation_answer_not_generated_when_no_equals() {
        let outcome = apply_local_split_rules("① 12 ② 15 ③ 18");
        let eq_cand = outcome.candidates.iter().find(|c| c.rule_id.ends_with("-equation-answer"));
        assert!(eq_cand.is_none(), "should not generate equation-answer variant when no '=' present");
    }
}
