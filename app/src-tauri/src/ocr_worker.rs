//! Drive the C# + Tesseract OCR worker (`tools/ocr-worker`) as a subprocess.
//!
//! The worker rasterizes a stored PDF or image, runs local Japanese OCR, splits each
//! page into question candidates, and writes
//! `<DATA_DIR>/content/extractions/<id>/extraction-result.json` plus page and region
//! images. This mirrors how [`crate::codex`] drives `codex app-server`: an external
//! worker as a child process, located via an env override or a conventional path.
//!
//! Stage scope (spec §11.3): this is Stage 1–2 (local rasterize + OCR + candidate
//! split). Everything it emits is `reviewStatus: "draft"` — nothing is approved for
//! use until an adult confirms it.

use std::path::{Path, PathBuf};
use std::process::Stdio;

use serde::{Deserialize, Serialize};
use tokio::process::Command;

/// Region as ratios of the page (0..1), resolution-independent.
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegionRatio {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PageResult {
    pub page: u32,
    pub width: u32,
    pub height: u32,
    pub image_path: String,
    pub ocr_text: String,
    pub mean_confidence: f64,
}

/// A proposed question region. Always a suggestion — never auto-approved.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CandidateResult {
    pub candidate_id: String,
    pub page: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub item_label: Option<String>,
    pub region: RegionRatio,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub region_image_path: Option<String>,
    pub ocr_text: String,
    pub confidence: f64,
    pub suggested_question_type: String,
    pub review_status: String,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportMetrics {
    pub extraction_route: String,
    pub local_ocr_engine: String,
    pub pages: u32,
    pub candidate_questions: u32,
    pub ai_assisted_regions: u32,
    pub adult_corrections: u32,
    pub elapsed_ms: u64,
    pub estimated_api_cost_usd: f64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractionResult {
    pub source_document_id: String,
    pub engine: String,
    pub engine_version: String,
    pub language: String,
    pub dpi: u32,
    pub generated_at_epoch_seconds: i64,
    pub page_count: u32,
    pub pages: Vec<PageResult>,
    pub candidates: Vec<CandidateResult>,
    pub metrics: ImportMetrics,
}

/// Optional knobs forwarded to the worker CLI. All default to the worker's own
/// defaults (300 DPI, `jpn+jpn_vert`, crops enabled, all pages).
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractionOptions {
    pub dpi: Option<u32>,
    pub language: Option<String>,
    pub tessdata: Option<String>,
    pub password: Option<String>,
    pub no_crops: Option<bool>,
    pub max_pages: Option<u32>,
}

/// Resolve how to launch the worker. Override with `MYMANABI_OCR_WORKER`; otherwise
/// use a conventional dev-build path, then fall back to the name on `PATH`.
fn worker_command() -> Command {
    if let Ok(path) = std::env::var("MYMANABI_OCR_WORKER") {
        return Command::new(path);
    }

    let exe_name = if cfg!(windows) {
        "MyManabi.OcrWorker.exe"
    } else {
        "MyManabi.OcrWorker"
    };
    let bin_base = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
        .join("tools")
        .join("ocr-worker")
        .join("src")
        .join("MyManabi.OcrWorker")
        .join("bin");
    for profile in ["Release", "Debug"] {
        let candidate = bin_base.join(profile).join("net8.0").join(exe_name);
        if candidate.exists() {
            return Command::new(candidate);
        }
    }

    Command::new("MyManabi.OcrWorker")
}

/// Run the local extraction worker for one stored `SourceDocument`.
pub async fn extract_source_document(
    data_dir: &Path,
    source_document_id: &str,
    options: &ExtractionOptions,
) -> Result<ExtractionResult, String> {
    let mut command = worker_command();
    command
        .arg("--source-document")
        .arg(source_document_id)
        .arg("--data-dir")
        .arg(data_dir)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    if let Some(dpi) = options.dpi {
        command.arg("--dpi").arg(dpi.to_string());
    }
    if let Some(language) = &options.language {
        command.arg("--lang").arg(language);
    }
    if let Some(tessdata) = &options.tessdata {
        command.arg("--tessdata").arg(tessdata);
    }
    if let Some(password) = &options.password {
        command.arg("--password").arg(password);
    }
    if options.no_crops.unwrap_or(false) {
        command.arg("--no-crops");
    }
    if let Some(max_pages) = options.max_pages {
        command.arg("--max-pages").arg(max_pages.to_string());
    }

    let output = command.output().await.map_err(|error| {
        format!(
            "launch OCR worker: {error}. Build tools/ocr-worker (dotnet build -c Release) \
             or set MYMANABI_OCR_WORKER to the executable."
        )
    })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "OCR worker failed ({}): {}",
            output.status,
            stderr.trim()
        ));
    }

    // The worker writes a durable artifact at a deterministic path; read that instead
    // of parsing stdout, to avoid any console-encoding ambiguity around Japanese text.
    let result_path = data_dir
        .join("content")
        .join("extractions")
        .join(source_document_id)
        .join("extraction-result.json");
    let bytes = std::fs::read(&result_path)
        .map_err(|error| format!("read extraction result {}: {error}", result_path.display()))?;
    serde_json::from_slice(&bytes).map_err(|error| format!("parse extraction result: {error}"))
}

/// Return the local review artifact path so the UI can make DATA_DIR storage visible.
pub fn extraction_result_path(data_dir: &Path, source_document_id: &str) -> Result<PathBuf, String> {
    validate_source_document_id(source_document_id)?;
    Ok(data_dir
        .join("content")
        .join("extractions")
        .join(source_document_id)
        .join("extraction-result.json"))
}

/// Reload an existing extraction result for review.
pub fn load_extraction_result(
    data_dir: &Path,
    source_document_id: &str,
) -> Result<ExtractionResult, String> {
    let path = extraction_result_path(data_dir, source_document_id)?;
    let bytes = std::fs::read(&path)
        .map_err(|error| format!("read extraction result {}: {error}", path.display()))?;
    serde_json::from_slice(&bytes).map_err(|error| format!("parse extraction result: {error}"))
}

/// Save one adult review decision. This approves the OCR candidate as reviewed
/// source material; it does not create a presentable Question without an answer
/// and learning metadata.
pub fn review_extraction_candidate(
    data_dir: &Path,
    source_document_id: &str,
    candidate_id: &str,
    ocr_text: &str,
    review_status: &str,
) -> Result<ExtractionResult, String> {
    if !matches!(review_status, "draft" | "adult-approved" | "suspended") {
        return Err(format!("unsupported candidate review status: {review_status}"));
    }
    if review_status == "adult-approved" && ocr_text.trim().is_empty() {
        return Err("approved candidate text must not be empty".to_owned());
    }

    let mut result = load_extraction_result(data_dir, source_document_id)?;
    let candidate = result
        .candidates
        .iter_mut()
        .find(|candidate| candidate.candidate_id == candidate_id)
        .ok_or_else(|| format!("candidate not found: {candidate_id}"))?;
    candidate.ocr_text = ocr_text.to_owned();
    candidate.review_status = review_status.to_owned();

    let path = extraction_result_path(data_dir, source_document_id)?;
    let bytes = serde_json::to_vec_pretty(&result)
        .map_err(|error| format!("serialize extraction result: {error}"))?;
    std::fs::write(&path, bytes)
        .map_err(|error| format!("write extraction result {}: {error}", path.display()))?;
    Ok(result)
}

fn validate_source_document_id(source_document_id: &str) -> Result<(), String> {
    if !source_document_id.is_empty()
        && source_document_id
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
    {
        return Ok(());
    }

    Err(format!(
        "invalid source document id: {source_document_id}"
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_data_dir() -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock after epoch")
            .as_nanos();
        std::env::temp_dir().join(format!("mymanabi-extraction-review-{nonce}"))
    }

    #[test]
    fn saves_adult_review_for_candidate() {
        let data_dir = temp_data_dir();
        let result_path = extraction_result_path(&data_dir, "source-1").expect("result path");
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
                "ocrText":"before",
                "confidence":0.8,
                "suggestedQuestionType":"unknown",
                "reviewStatus":"draft"
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

        let updated = review_extraction_candidate(
            &data_dir,
            "source-1",
            "source-1-p001-c01",
            "after",
            "adult-approved",
        )
        .expect("save review");

        assert_eq!(updated.candidates[0].ocr_text, "after");
        assert_eq!(updated.candidates[0].review_status, "adult-approved");
        std::fs::remove_dir_all(data_dir).expect("remove temp data dir");
    }

    #[test]
    fn rejects_source_document_path_traversal() {
        let error = extraction_result_path(Path::new("data"), "../private")
            .expect_err("reject path traversal");

        assert_eq!(error, "invalid source document id: ../private");
    }
}
