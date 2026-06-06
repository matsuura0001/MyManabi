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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub body: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub presentation: Option<Presentation>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expected_response: Option<ExpectedResponse>,
    pub note: String,
    pub answer: Answer,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_mapping: Option<SourceMapping>,
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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub value: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text_value: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub document_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub page: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub region: Option<RegionRatio>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub image_path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub media_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub transcript: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rubric: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tags: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Presentation {
    pub r#type: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub document_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub page: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub region: Option<RegionRatio>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub image_path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub media_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub transcript: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub show_transcript: Option<bool>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExpectedResponse {
    pub r#type: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rubric: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceMapping {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub question_region_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub answer_region_id: Option<String>,
    pub relation: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub item_label: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub confidence: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RegionRatio {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
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
    let bytes = serde_json::to_vec_pretty(question)
        .map_err(|error| format!("serialize question {}: {error}", question.id))?;
    fs::write(&path, bytes)
        .map_err(|error| format!("write question {}: {error}", path.display()))?;
    Ok(question.clone())
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteResult {
    pub deleted_count: u32,
    pub invalidated_count: u32,
}

pub fn delete_or_invalidate_question(data_dir: &Path, question_id: &str) -> Result<DeleteResult, String> {
    validate_question_id(question_id)?;
    let questions_dir = data_dir.join("content").join("questions");
    let path = questions_dir.join(format!("{}.json", question_id));
    if !path.exists() {
        return Ok(DeleteResult { deleted_count: 0, invalidated_count: 0 });
    }

    let text = fs::read_to_string(&path)
        .map_err(|error| format!("read question {}: {error}", path.display()))?;
    let mut question: Question = serde_json::from_str(&text)
        .map_err(|error| format!("parse question {}: {error}", path.display()))?;

    // Check if any learner has attempted this question
    let learners = crate::domain::list_learners(data_dir)?;
    let mut is_attempted = false;
    for learner in learners {
        if let Ok(state) = crate::domain::load_learner_question_state(data_dir, &learner.id, question_id) {
            if state.attempts > 0 {
                is_attempted = true;
                break;
            }
        }
    }

    if is_attempted {
        question.review_status = "invalidated".to_owned();
        let bytes = serde_json::to_vec_pretty(&question)
            .map_err(|error| format!("serialize question {}: {error}", question.id))?;
        fs::write(&path, bytes)
            .map_err(|error| format!("write question {}: {error}", path.display()))?;
        Ok(DeleteResult { deleted_count: 0, invalidated_count: 1 })
    } else {
        fs::remove_file(&path)
            .map_err(|error| format!("delete question {}: {error}", path.display()))?;
        Ok(DeleteResult { deleted_count: 1, invalidated_count: 0 })
    }
}

pub fn delete_or_invalidate_questions_by_source(data_dir: &Path, source_document_id: &str) -> Result<DeleteResult, String> {
    let questions_dir = data_dir.join("content").join("questions");
    let entries = match fs::read_dir(&questions_dir) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(DeleteResult { deleted_count: 0, invalidated_count: 0 }),
        Err(error) => return Err(format!("read question bank {}: {error}", questions_dir.display())),
    };

    let mut target_question_ids = Vec::new();

    for entry in entries.filter_map(Result::ok) {
        let path = entry.path();
        if path.extension().and_then(|value| value.to_str()) != Some("json") {
            continue;
        }

        if let Ok(text) = fs::read_to_string(&path) {
            if let Ok(question) = serde_json::from_str::<Question>(&text) {
                if question.source.document_id.as_deref() == Some(source_document_id) {
                    target_question_ids.push(question.id);
                }
            }
        }
    }

    let mut total_deleted = 0;
    let mut total_invalidated = 0;

    for id in target_question_ids {
        let res = delete_or_invalidate_question(data_dir, &id)?;
        total_deleted += res.deleted_count;
        total_invalidated += res.invalidated_count;
    }

    Ok(DeleteResult {
        deleted_count: total_deleted,
        invalidated_count: total_invalidated,
    })
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
    if question
        .skill_ids
        .iter()
        .any(|skill| skill.trim().is_empty())
    {
        return Err("question skillIds must not contain empty strings".to_owned());
    }
    if !matches!(
        question.question_type.as_str(),
        "numeric"
            | "kanji"
            | "multiple-choice"
            | "word-problem"
            | "free-text"
            | "handwriting"
            | "speech"
    ) {
        return Err(format!(
            "unsupported question type: {}",
            question.question_type
        ));
    }
    if question.title.trim().is_empty() {
        return Err("question title must not be empty".to_owned());
    }
    let has_body = question
        .body
        .as_deref()
        .is_some_and(|body| !body.trim().is_empty());
    if !has_body && question.presentation.is_none() {
        return Err("question must have body text or presentation".to_owned());
    }
    validate_answer(&question.answer)?;
    if let Some(presentation) = &question.presentation {
        validate_presentation(presentation)?;
    }
    if question.review_status != "adult-approved" {
        return Err("promoted question must be adult-approved".to_owned());
    }
    if question.purposes.is_empty() {
        return Err("question purposes must not be empty".to_owned());
    }
    if question
        .purposes
        .iter()
        .any(|purpose| !matches!(purpose.as_str(), "learning" | "review" | "assessment"))
    {
        return Err("question purposes include an unsupported value".to_owned());
    }
    Ok(())
}

fn validate_answer(answer: &Answer) -> Result<(), String> {
    match answer.r#type.as_str() {
        "exact-text" | "numeric" | "choice" | "ai-assisted" => {
            if answer
                .value
                .as_deref()
                .is_none_or(|value| value.trim().is_empty())
            {
                return Err("text answer value must not be empty".to_owned());
            }
        }
        "source-region" => {
            if answer.document_id.as_deref().is_none_or(str::is_empty)
                || answer.page.is_none()
                || answer.region.is_none()
            {
                return Err("source-region answer requires documentId, page and region".to_owned());
            }
        }
        "image" | "exemplar-image" => {
            if answer.image_path.as_deref().is_none_or(str::is_empty)
                && answer.media_id.as_deref().is_none_or(str::is_empty)
            {
                return Err("image answer requires imagePath or mediaId".to_owned());
            }
        }
        "audio" | "exemplar-audio" => {
            if answer.media_id.as_deref().is_none_or(str::is_empty) {
                return Err("audio answer requires mediaId".to_owned());
            }
        }
        "manual-review" => {}
        other => return Err(format!("unsupported answer type: {other}")),
    }
    Ok(())
}

fn validate_presentation(presentation: &Presentation) -> Result<(), String> {
    match presentation.r#type.as_str() {
        "text" => {
            if presentation
                .text
                .as_deref()
                .is_none_or(|text| text.trim().is_empty())
            {
                return Err("text presentation requires text".to_owned());
            }
        }
        "source-region" => {
            if presentation
                .document_id
                .as_deref()
                .is_none_or(str::is_empty)
                || presentation.page.is_none()
                || presentation.region.is_none()
            {
                return Err(
                    "source-region presentation requires documentId, page and region".to_owned(),
                );
            }
        }
        "image" => {
            if presentation.image_path.as_deref().is_none_or(str::is_empty)
                && presentation.media_id.as_deref().is_none_or(str::is_empty)
            {
                return Err("image presentation requires imagePath or mediaId".to_owned());
            }
        }
        "audio" => {
            if presentation.media_id.as_deref().is_none_or(str::is_empty) {
                return Err("audio presentation requires mediaId".to_owned());
            }
        }
        other => return Err(format!("unsupported presentation type: {other}")),
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
            body: Some("山".to_owned()),
            presentation: None,
            expected_response: None,
            note: "".to_owned(),
            answer: Answer {
                r#type: "exact-text".to_owned(),
                value: Some("山".to_owned()),
                text_value: None,
                document_id: None,
                page: None,
                region: None,
                image_path: None,
                media_id: None,
                transcript: None,
                rubric: None,
                tags: Vec::new(),
            },
            source_mapping: None,
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

    #[test]
    fn saves_source_region_question_without_body_text() {
        let data_dir = temp_data_dir();
        let question = Question {
            id: "imported-region-1".to_owned(),
            subject: "算数".to_owned(),
            unit_id: "angles".to_owned(),
            skill_ids: vec!["measure-angle".to_owned()],
            question_type: "numeric".to_owned(),
            title: "角度をはかろう".to_owned(),
            body: None,
            presentation: Some(Presentation {
                r#type: "source-region".to_owned(),
                text: None,
                document_id: Some("angle-print-question".to_owned()),
                page: Some(1),
                region: Some(RegionRatio {
                    x: 0.1,
                    y: 0.2,
                    width: 0.3,
                    height: 0.2,
                }),
                image_path: None,
                media_id: None,
                transcript: None,
                show_transcript: None,
            }),
            expected_response: Some(ExpectedResponse {
                r#type: "numeric".to_owned(),
                rubric: None,
            }),
            note: "".to_owned(),
            answer: Answer {
                r#type: "source-region".to_owned(),
                value: None,
                text_value: Some("90°".to_owned()),
                document_id: Some("angle-print-answer".to_owned()),
                page: Some(1),
                region: Some(RegionRatio {
                    x: 0.1,
                    y: 0.2,
                    width: 0.3,
                    height: 0.2,
                }),
                image_path: None,
                media_id: None,
                transcript: None,
                rubric: None,
                tags: vec!["right-angle".to_owned()],
            },
            source_mapping: Some(SourceMapping {
                question_region_id: Some("qreg-001".to_owned()),
                answer_region_id: Some("areg-001".to_owned()),
                relation: "same-item".to_owned(),
                item_label: Some("1".to_owned()),
                confidence: Some("adult-confirmed".to_owned()),
            }),
            source: Source {
                r#type: "imported".to_owned(),
                template_id: None,
                document_id: Some("angle-print-question".to_owned()),
                page: Some(1),
                item_label: Some("1".to_owned()),
            },
            review_status: "adult-approved".to_owned(),
            purposes: vec!["learning".to_owned()],
            assessment: None,
        };

        save_approved_question(&data_dir, &question).expect("save source-region question");
        fs::remove_dir_all(data_dir).expect("remove temp data dir");
    }
}
