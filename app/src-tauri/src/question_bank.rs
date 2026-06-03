//! Read approved questions from the local DATA_DIR.

use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Question {
    pub id: String,
    pub subject: String,
    pub unit_id: String,
    pub skill_ids: Vec<String>,
    pub question_type: String,
    pub title: String,
    pub body: String,
    pub note: String,
    pub answer: Answer,
    pub source: Source,
    pub review_status: String,
    pub purposes: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub assessment: Option<Assessment>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Answer {
    pub r#type: String,
    pub value: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Source {
    pub r#type: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub template_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub document_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub page: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub item_label: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Assessment {
    pub equivalence_group_id: String,
    pub relation: String,
}

pub fn default_data_dir() -> Result<PathBuf, String> {
    if let Ok(path) = std::env::var("MYMANABI_DATA_DIR") {
        return Ok(PathBuf::from(path));
    }

    std::env::var("APPDATA")
        .map(PathBuf::from)
        .map(|path| path.join("MyManabi"))
        .map_err(|_| "APPDATA is unavailable; set MYMANABI_DATA_DIR".to_owned())
}

pub fn load_approved_questions(data_dir: &Path) -> Result<Vec<Question>, String> {
    let questions_dir = data_dir.join("content").join("questions");
    let entries = fs::read_dir(&questions_dir)
        .map_err(|error| format!("read question bank {}: {error}", questions_dir.display()))?;
    let mut paths = entries
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.extension().and_then(|value| value.to_str()) == Some("json"))
        .collect::<Vec<_>>();
    paths.sort();

    let mut questions = Vec::new();
    for path in paths {
        let text = fs::read_to_string(&path)
            .map_err(|error| format!("read question {}: {error}", path.display()))?;
        let question: Question = serde_json::from_str(&text)
            .map_err(|error| format!("parse question {}: {error}", path.display()))?;
        if is_presentable(&question) {
            questions.push(question);
        }
    }
    Ok(questions)
}

pub fn load_approved_questions_by_ids(
    data_dir: &Path,
    question_ids: &[String],
) -> Result<Vec<Question>, String> {
    let questions_dir = data_dir.join("content").join("questions");
    let unique_ids = question_ids.iter().collect::<BTreeSet<_>>();
    let mut questions = Vec::new();

    for question_id in unique_ids {
        validate_question_id(question_id)?;
        let path = questions_dir.join(format!("{question_id}.json"));
        let text = fs::read_to_string(&path)
            .map_err(|error| format!("read question {}: {error}", path.display()))?;
        let question: Question = serde_json::from_str(&text)
            .map_err(|error| format!("parse question {}: {error}", path.display()))?;

        if question.id != *question_id {
            return Err(format!(
                "question id {} does not match file name {}",
                question.id, question_id
            ));
        }

        if is_presentable(&question) {
            questions.push(question);
        }
    }
    Ok(questions)
}

pub fn save_approved_question(data_dir: &Path, question: &Question) -> Result<Question, String> {
    validate_question(question)?;

    let questions_dir = data_dir.join("content").join("questions");
    fs::create_dir_all(&questions_dir)
        .map_err(|error| format!("create question bank {}: {error}", questions_dir.display()))?;
    let path = questions_dir.join(format!("{}.json", question.id));
    if path.exists() {
        return Err(format!("question already exists: {}", question.id));
    }

    let bytes = serde_json::to_vec_pretty(question)
        .map_err(|error| format!("serialize question {}: {error}", question.id))?;
    fs::write(&path, bytes).map_err(|error| format!("write question {}: {error}", path.display()))?;
    Ok(question.clone())
}

fn is_presentable(question: &Question) -> bool {
    matches!(
        question.review_status.as_str(),
        "adult-approved" | "auto-approved"
    )
}

pub fn validate_question_id(question_id: &str) -> Result<(), String> {
    if !question_id.is_empty()
        && question_id
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
    {
        return Ok(());
    }

    Err(format!("invalid question id: {question_id}"))
}

fn validate_question(question: &Question) -> Result<(), String> {
    validate_question_id(&question.id)?;
    if question.subject.trim().is_empty() {
        return Err("question subject must not be empty".to_owned());
    }
    if question.unit_id.trim().is_empty() {
        return Err("question unitId must not be empty".to_owned());
    }
    if question.skill_ids.is_empty() || question.skill_ids.iter().any(|skill| skill.trim().is_empty()) {
        return Err("question skillIds must not be empty".to_owned());
    }
    if !matches!(
        question.question_type.as_str(),
        "numeric" | "kanji" | "multiple-choice" | "word-problem" | "free-text" | "handwriting" | "speech"
    ) {
        return Err(format!("unsupported question type: {}", question.question_type));
    }
    if question.title.trim().is_empty() {
        return Err("question title must not be empty".to_owned());
    }
    if question.body.trim().is_empty() {
        return Err("question body must not be empty".to_owned());
    }
    if question.answer.value.trim().is_empty() {
        return Err("question answer must not be empty".to_owned());
    }
    if question.review_status != "adult-approved" {
        return Err("promoted question must be adult-approved".to_owned());
    }
    if question.purposes.is_empty() {
        return Err("question purposes must not be empty".to_owned());
    }
    if question.purposes.iter().any(|purpose| {
        !matches!(
            purpose.as_str(),
            "learning" | "review" | "assessment"
        )
    }) {
        return Err("question purposes include an unsupported value".to_owned());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_data_dir() -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock should be after epoch")
            .as_nanos();
        std::env::temp_dir().join(format!("mymanabi-question-bank-{nonce}"))
    }

    #[test]
    fn loads_only_approved_questions() {
        let data_dir = temp_data_dir();
        let questions_dir = data_dir.join("content").join("questions");
        fs::create_dir_all(&questions_dir).expect("create questions dir");
        fs::write(
            questions_dir.join("approved.json"),
            r#"{
                "id":"q-approved",
                "subject":"算数",
                "unitId":"fraction-addition",
                "skillIds":["same-denominator"],
                "questionType":"numeric",
                "title":"計算しよう",
                "body":"1/4 + 2/4 = ?",
                "note":"合成問題",
                "answer":{"type":"exact-text","value":"3/4"},
                "source":{"type":"adult-authored"},
                "reviewStatus":"adult-approved",
                "purposes":["learning"]
            }"#,
        )
        .expect("write approved question");
        fs::write(
            questions_dir.join("draft.json"),
            r#"{
                "id":"q-draft",
                "subject":"算数",
                "unitId":"fraction-addition",
                "skillIds":["same-denominator"],
                "questionType":"numeric",
                "title":"計算しよう",
                "body":"2/4 + 1/4 = ?",
                "note":"合成問題",
                "answer":{"type":"exact-text","value":"3/4"},
                "source":{"type":"adult-authored"},
                "reviewStatus":"draft",
                "purposes":["learning"]
            }"#,
        )
        .expect("write draft question");

        let questions = load_approved_questions(&data_dir).expect("load approved questions");
        assert_eq!(questions.len(), 1);
        assert_eq!(questions[0].id, "q-approved");

        fs::remove_dir_all(data_dir).expect("remove temp data dir");
    }

    #[test]
    fn loads_repository_synthetic_questions() {
        let data_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("..")
            .join("examples")
            .join("data-dir");

        let questions = load_approved_questions(&data_dir).expect("load synthetic questions");
        assert_eq!(questions.len(), 2);
        assert!(questions.iter().all(|question| matches!(
            question.review_status.as_str(),
            "adult-approved" | "auto-approved"
        )));
    }

    #[test]
    fn loads_only_requested_repository_synthetic_questions() {
        let data_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("..")
            .join("examples")
            .join("data-dir");
        let questions =
            load_approved_questions_by_ids(&data_dir, &["synthetic-fraction-story-01".to_owned()])
                .expect("load requested synthetic question");

        assert_eq!(questions.len(), 1);
        assert_eq!(questions[0].id, "synthetic-fraction-story-01");
    }

    #[test]
    fn rejects_question_id_path_traversal() {
        let data_dir = temp_data_dir();
        let error = load_approved_questions_by_ids(&data_dir, &["../private".to_owned()])
            .expect_err("path traversal should be rejected");

        assert_eq!(error, "invalid question id: ../private");
    }

    #[test]
    fn saves_approved_question_without_null_optional_fields() {
        let data_dir = temp_data_dir();
        let question = Question {
            id: "imported-q-1".to_owned(),
            subject: "国語".to_owned(),
            unit_id: "kanji".to_owned(),
            skill_ids: vec!["kanji-writing".to_owned()],
            question_type: "kanji".to_owned(),
            title: "漢字を書こう".to_owned(),
            body: "山".to_owned(),
            note: "".to_owned(),
            answer: Answer {
                r#type: "exact-text".to_owned(),
                value: "山".to_owned(),
            },
            source: Source {
                r#type: "imported".to_owned(),
                template_id: None,
                document_id: Some("source-1".to_owned()),
                page: Some(1),
                item_label: None,
            },
            review_status: "adult-approved".to_owned(),
            purposes: vec!["learning".to_owned()],
            assessment: None,
        };

        save_approved_question(&data_dir, &question).expect("save approved question");
        let text = fs::read_to_string(
            data_dir
                .join("content")
                .join("questions")
                .join("imported-q-1.json"),
        )
        .expect("read saved question");

        assert!(!text.contains(": null"));
        assert!(text.contains("\"reviewStatus\": \"adult-approved\""));
        fs::remove_dir_all(data_dir).expect("remove temp data dir");
    }
}
