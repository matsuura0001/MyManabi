// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
pub mod codex;
pub mod content_index;
pub mod ocr_worker;
pub mod question_bank;
pub mod selection;
pub mod source_document;

use codex::SpikeOutcome;
use question_bank::Question;

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

/// Run the local OCR worker over a stored PDF and return question candidates for
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            codex_spike,
            load_question_bank,
            load_question_bank_for_notes,
            import_pdf_from_url,
            extract_source_document
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

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
}
