//! Minimal Obsidian Vault index for the initial PoC.
//!
//! Only `id` and `question_ids` are parsed for now. Replace this with a YAML
//! parser when the Vault schema grows.

use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct VaultNote {
    pub id: String,
    pub path: PathBuf,
    pub question_ids: Vec<String>,
}

pub fn load_vault_notes(data_dir: &Path) -> Result<Vec<VaultNote>, String> {
    let vault_dir = data_dir.join("content").join("vault");
    let mut markdown_paths = Vec::new();
    collect_markdown_paths(&vault_dir, &mut markdown_paths)?;
    markdown_paths.sort();
    let notes = markdown_paths
        .into_iter()
        .map(|path| load_vault_note(&path))
        .collect::<Result<Vec<_>, _>>()?;
    Ok(notes.into_iter().flatten().collect())
}

pub fn question_ids_for_notes(notes: &[VaultNote], note_ids: &[String]) -> Vec<String> {
    let selected = note_ids.iter().collect::<BTreeSet<_>>();
    notes
        .iter()
        .filter(|note| selected.contains(&note.id))
        .flat_map(|note| note.question_ids.iter().cloned())
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect()
}

fn collect_markdown_paths(dir: &Path, paths: &mut Vec<PathBuf>) -> Result<(), String> {
    let entries = fs::read_dir(dir)
        .map_err(|error| format!("read Vault directory {}: {error}", dir.display()))?;
    for entry in entries {
        let path = entry
            .map_err(|error| format!("read Vault entry {}: {error}", dir.display()))?
            .path();
        if path.is_dir() {
            collect_markdown_paths(&path, paths)?;
        } else if path.extension().and_then(|value| value.to_str()) == Some("md") {
            paths.push(path);
        }
    }
    Ok(())
}

fn load_vault_note(path: &Path) -> Result<Option<VaultNote>, String> {
    let text = fs::read_to_string(path)
        .map_err(|error| format!("read Vault note {}: {error}", path.display()))?;
    parse_vault_note(path, &text)
}

fn parse_vault_note(path: &Path, text: &str) -> Result<Option<VaultNote>, String> {
    let normalized = text.replace("\r\n", "\n");
    let Some(frontmatter) = normalized
        .strip_prefix("---\n")
        .and_then(|rest| rest.split_once("\n---"))
        .map(|(value, _)| value)
    else {
        return Ok(None);
    };
    let mut id = None;
    let mut question_ids = Vec::new();
    let mut reading_question_ids = false;

    for line in frontmatter.lines() {
        if let Some(value) = line.strip_prefix("id:") {
            id = Some(value.trim().to_owned());
            reading_question_ids = false;
            continue;
        }
        if line.trim() == "question_ids:" {
            reading_question_ids = true;
            continue;
        }
        if reading_question_ids {
            if let Some(value) = line.trim().strip_prefix("- ") {
                question_ids.push(value.trim().to_owned());
                continue;
            }
            if !line.starts_with(' ') {
                reading_question_ids = false;
            }
        }
    }

    let id = id.ok_or_else(|| format!("Vault note {} has no id", path.display()))?;
    Ok(Some(VaultNote {
        id,
        path: path.to_owned(),
        question_ids,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_question_ids_from_frontmatter() {
        let note = parse_vault_note(
            Path::new("fraction-addition.md"),
            r#"---
id: fraction-addition
question_ids:
  - q-001
  - q-002
---

# 分数のたし算
"#,
        )
        .expect("parse Vault note")
        .expect("indexed Vault note");

        assert_eq!(note.id, "fraction-addition");
        assert_eq!(note.question_ids, vec!["q-001", "q-002"]);
    }

    #[test]
    fn ignores_plain_markdown_notes() {
        let note = parse_vault_note(Path::new("memo.md"), "# 自由メモ").expect("parse plain note");

        assert_eq!(note, None);
    }

    #[test]
    fn selects_unique_question_ids_for_notes() {
        let notes = vec![
            VaultNote {
                id: "unit-a".to_owned(),
                path: PathBuf::from("unit-a.md"),
                question_ids: vec!["q-001".to_owned(), "q-002".to_owned()],
            },
            VaultNote {
                id: "print-a".to_owned(),
                path: PathBuf::from("print-a.md"),
                question_ids: vec!["q-002".to_owned(), "q-003".to_owned()],
            },
        ];

        assert_eq!(
            question_ids_for_notes(&notes, &["unit-a".to_owned(), "print-a".to_owned()]),
            vec!["q-001", "q-002", "q-003"]
        );
    }

    #[test]
    fn loads_repository_synthetic_vault() {
        let data_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("..")
            .join("examples")
            .join("data-dir");
        let notes = load_vault_notes(&data_dir).expect("load synthetic Vault");
        let question_ids = question_ids_for_notes(&notes, &["fraction-addition".to_owned()]);

        assert_eq!(
            question_ids,
            vec!["synthetic-fraction-basic-01", "synthetic-fraction-story-01"]
        );
    }
}
