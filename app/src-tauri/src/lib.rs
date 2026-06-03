// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
pub mod codex;
pub mod content_index;
pub mod ocr_worker;
pub mod question_bank;
pub mod selection;
pub mod source_document;

use codex::SpikeOutcome;
use question_bank::{Answer, Question, Source};
use serde::Deserialize;

/// Connectivity spike: drive `codex app-server` for one text turn and return
/// the signed-in account plus the generated text.
#[tauri::command]
async fn codex_spike(prompt: String) -> Result<SpikeOutcome, String> {
    codex::run_spike(&prompt).await
}

/// Load approved questions from `<DATA_DIR>/content/questions/*.json`.
#[tauri::command]
fn load_question_bank(data_dir: Option<String>) -> Result<Vec<Question>, String> {
    let data_dir = resolve_data_dir(data_dir)?;
    question_bank::load_approved_questions(&data_dir)
}

/// Load only questions linked from selected Obsidian Vault notes.
///
/// The zero-weight closure is the initial PoC baseline. Learner history,
/// parent suggestions and preferences can later feed this in-memory boundary.
#[tauri::command]
fn load_question_bank_for_notes(
    data_dir: Option<String>,
    note_ids: Vec<String>,
) -> Result<Vec<Question>, String> {
    let data_dir = resolve_data_dir(data_dir)?;
    let notes = content_index::load_vault_notes(&data_dir)?;
    let question_ids = content_index::question_ids_for_notes(&notes, &note_ids);
    let questions = question_bank::load_approved_questions_by_ids(&data_dir, &question_ids)?;
    Ok(selection::rank_questions_by_weight(questions, |_| 0))
}

fn resolve_data_dir(data_dir: Option<String>) -> Result<std::path::PathBuf, String> {
    data_dir
        .map(std::path::PathBuf::from)
        .map(Ok)
        .unwrap_or_else(question_bank::default_data_dir)
}

#[tauri::command]
async fn import_pdf_from_url(
    data_dir: Option<String>,
    url: String,
) -> Result<source_document::SourceDocument, String> {
    let data_dir = resolve_data_dir(data_dir)?;
    source_document::import_pdf_from_url(&data_dir, &url).await
}

/// Copy a local source file into DATA_DIR before extraction. The selected source
/// remains local and is never written into the public repository.
#[tauri::command]
fn import_source_from_path(
    data_dir: Option<String>,
    path: String,
) -> Result<source_document::SourceDocument, String> {
    let data_dir = resolve_data_dir(data_dir)?;
    source_document::import_source_from_path(&data_dir, std::path::Path::new(&path))
}

#[tauri::command]
fn list_source_documents(
    data_dir: Option<String>,
) -> Result<Vec<source_document::SourceDocument>, String> {
    let data_dir = resolve_data_dir(data_dir)?;
    source_document::list_source_documents(&data_dir)
}

/// Run the local extraction worker over a stored source and return question candidates for
/// review. Drives `tools/ocr-worker` (C# + Tesseract) as a subprocess; everything it
/// returns is `reviewStatus: "draft"` until an adult confirms it.
#[tauri::command]
async fn extract_source_document(
    data_dir: Option<String>,
    source_document_id: String,
    options: Option<ocr_worker::ExtractionOptions>,
) -> Result<ocr_worker::ExtractionResult, String> {
    let data_dir = resolve_data_dir(data_dir)?;
    let options = options.unwrap_or_default();
    ocr_worker::extract_source_document(&data_dir, &source_document_id, &options).await
}

#[tauri::command]
fn extraction_result_path(
    data_dir: Option<String>,
    source_document_id: String,
) -> Result<String, String> {
    let data_dir = resolve_data_dir(data_dir)?;
    ocr_worker::extraction_result_path(&data_dir, &source_document_id)
        .map(|path| path.to_string_lossy().into_owned())
}

#[tauri::command]
fn load_extraction_result(
    data_dir: Option<String>,
    source_document_id: String,
) -> Result<ocr_worker::ExtractionResult, String> {
    let data_dir = resolve_data_dir(data_dir)?;
    ocr_worker::load_extraction_result(&data_dir, &source_document_id)
}

#[tauri::command]
async fn reextract_candidate_region(
    data_dir: Option<String>,
    source_document_id: String,
    candidate_id: String,
    region: ocr_worker::RegionRatio,
) -> Result<ocr_worker::ExtractionResult, String> {
    let data_dir = resolve_data_dir(data_dir)?;
    ocr_worker::reextract_candidate_region(&data_dir, &source_document_id, &candidate_id, &region)
        .await
}

#[tauri::command]
fn review_extraction_candidate(
    data_dir: Option<String>,
    source_document_id: String,
    candidate_id: String,
    ocr_text: String,
    review_status: String,
) -> Result<ocr_worker::ExtractionResult, String> {
    let data_dir = resolve_data_dir(data_dir)?;
    ocr_worker::review_extraction_candidate(
        &data_dir,
        &source_document_id,
        &candidate_id,
        &ocr_text,
        &review_status,
    )
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PromoteExtractionCandidateInput {
    source_document_id: String,
    candidate_id: String,
    question_id: String,
    subject: String,
    unit_id: String,
    skill_ids: Vec<String>,
    question_type: String,
    title: String,
    body: String,
    note: String,
    answer_value: String,
    purposes: Vec<String>,
}

#[tauri::command]
fn promote_extraction_candidate(
    data_dir: Option<String>,
    input: PromoteExtractionCandidateInput,
) -> Result<Question, String> {
    let data_dir = resolve_data_dir(data_dir)?;
    let result = ocr_worker::load_extraction_result(&data_dir, &input.source_document_id)?;
    let candidate = result
        .candidates
        .iter()
        .find(|candidate| candidate.candidate_id == input.candidate_id)
        .ok_or_else(|| format!("candidate not found: {}", input.candidate_id))?;
    if candidate.review_status != "adult-approved" {
        return Err("candidate must be adult-approved before promotion".to_owned());
    }

    let question_id = if input.question_id.trim().is_empty() {
        format!("imported-{}", candidate.candidate_id)
    } else {
        input.question_id.trim().to_owned()
    };
    question_bank::validate_question_id(&question_id)?;
    let question = Question {
        id: question_id,
        subject: input.subject.trim().to_owned(),
        unit_id: input.unit_id.trim().to_owned(),
        skill_ids: input
            .skill_ids
            .into_iter()
            .map(|skill| skill.trim().to_owned())
            .filter(|skill| !skill.is_empty())
            .collect(),
        question_type: input.question_type,
        title: input.title.trim().to_owned(),
        body: input.body,
        note: input.note,
        answer: Answer {
            r#type: "exact-text".to_owned(),
            value: input.answer_value.trim().to_owned(),
        },
        source: Source {
            r#type: "imported".to_owned(),
            template_id: None,
            document_id: Some(input.source_document_id),
            page: Some(candidate.page),
            item_label: candidate.item_label.clone(),
        },
        review_status: "adult-approved".to_owned(),
        purposes: input.purposes,
        assessment: None,
    };

    question_bank::save_approved_question(&data_dir, &question)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            codex_spike,
            load_question_bank,
            load_question_bank_for_notes,
            import_pdf_from_url,
            import_source_from_path,
            list_source_documents,
            extract_source_document,
            extraction_result_path,
            load_extraction_result,
            review_extraction_candidate,
            promote_extraction_candidate,
            reextract_candidate_region
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_data_dir() -> std::path::PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock after epoch")
            .as_nanos();
        std::env::temp_dir().join(format!("mymanabi-promote-{nonce}"))
    }

    #[test]
    fn loads_questions_linked_from_repository_synthetic_vault_note() {
        let data_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("..")
            .join("examples")
            .join("data-dir");
        let questions = load_question_bank_for_notes(
            Some(data_dir.to_string_lossy().into_owned()),
            vec!["fraction-addition".to_owned()],
        )
        .expect("load questions linked from Vault note");

        assert_eq!(questions.len(), 2);
    }

    #[test]
    fn promotes_approved_extraction_candidate_to_question_json() {
        let data_dir = temp_data_dir();
        let result_path =
            ocr_worker::extraction_result_path(&data_dir, "source-1").expect("result path");
        std::fs::create_dir_all(result_path.parent().expect("result parent"))
            .expect("create result dir");
        std::fs::write(
            &result_path,
            r#"{
              "sourceDocumentId":"source-1",
              "engine":"tesseract",
              "engineVersion":"5",
              "language":"jpn",
              "dpi":300,
              "generatedAtEpochSeconds":1,
              "pageCount":1,
              "pages":[],
              "candidates":[{
                "candidateId":"source-1-p001-c01",
                "page":1,
                "region":{"x":0,"y":0,"width":1,"height":1},
                "ocrText":"山を書く",
                "confidence":0.8,
                "suggestedQuestionType":"kanji",
                "reviewStatus":"adult-approved"
              }],
              "metrics":{
                "extractionRoute":"local-ocr",
                "localOcrEngine":"tesseract",
                "pages":1,
                "candidateQuestions":1,
                "aiAssistedRegions":0,
                "adultCorrections":0,
                "elapsedMs":1,
                "estimatedApiCostUsd":0
              }
            }"#,
        )
        .expect("write extraction result");

        let question = promote_extraction_candidate(
            Some(data_dir.to_string_lossy().into_owned()),
            PromoteExtractionCandidateInput {
                source_document_id: "source-1".to_owned(),
                candidate_id: "source-1-p001-c01".to_owned(),
                question_id: "imported-source-1-p001-c01".to_owned(),
                subject: "国語".to_owned(),
                unit_id: "kanji".to_owned(),
                skill_ids: vec!["kanji-writing".to_owned()],
                question_type: "kanji".to_owned(),
                title: "漢字を書こう".to_owned(),
                body: "山を書く".to_owned(),
                note: "".to_owned(),
                answer_value: "山".to_owned(),
                purposes: vec!["learning".to_owned()],
            },
        )
        .expect("promote candidate");

        assert_eq!(question.review_status, "adult-approved");
        assert!(data_dir
            .join("content")
            .join("questions")
            .join("imported-source-1-p001-c01.json")
            .exists());
        std::fs::remove_dir_all(data_dir).expect("remove temp data dir");
    }
}
