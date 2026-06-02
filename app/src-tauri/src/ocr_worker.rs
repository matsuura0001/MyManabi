//! Drive the C# + Tesseract OCR worker (`tools/ocr-worker`) as a subprocess.
//!
//! The worker rasterizes a stored PDF, runs local Japanese OCR, splits each page
//! into question candidates, and writes
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

/// Run the OCR worker for one stored `SourceDocument` and return its extraction result.
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
    let bytes = std::fs::read(&result_path).map_err(|error| {
        format!(
            "read extraction result {}: {error}",
            result_path.display()
        )
    })?;
    serde_json::from_slice(&bytes).map_err(|error| format!("parse extraction result: {error}"))
}
