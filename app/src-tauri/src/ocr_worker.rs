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
    pub confidence: f32,
    #[serde(rename = "suggestedQuestionType")]
    pub suggested_question_type: String,
    #[serde(rename = "suggestedSubject", skip_serializing_if = "Option::is_none")]
    pub suggested_subject: Option<String>,
    #[serde(rename = "suggestedUnitId", skip_serializing_if = "Option::is_none")]
    pub suggested_unit_id: Option<String>,
    #[serde(rename = "reviewStatus")]
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
    let profiles = if cfg!(debug_assertions) {
        ["Debug", "Release"]
    } else {
        ["Release", "Debug"]
    };
    for profile in profiles {
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

/// Rasterize a stored PDF/image into page images without running OCR. This creates
/// an extraction-result.json with pages and no candidates so the UI can build a
/// manual region plan before OCR.
pub async fn rasterize_source_document(
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
        .arg("--raster-only")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    if let Some(dpi) = options.dpi {
        command.arg("--dpi").arg(dpi.to_string());
    }
    if let Some(password) = &options.password {
        command.arg("--password").arg(password);
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

    load_extraction_result(data_dir, source_document_id)
}

/// Run AI-OCR extraction for a rasterized source document.
pub async fn extract_source_document_with_ai(
    data_dir: &Path,
    source_document_id: &str,
    options: &ExtractionOptions,
) -> Result<ExtractionResult, String> {
    // 1. Rasterize first (if not already done) to get page images
    let mut result = rasterize_source_document(data_dir, source_document_id, options).await?;

    let prompt = "Extract all math or text problems from these pages. Return a JSON array of objects, each containing: 'page' (the integer page number provided in the prompt), 'ocr_text' (the extracted text/math), 'confidence' (0.0 to 1.0 estimate of your reading confidence), 'suggested_question_type' (e.g. 'numeric', 'free-text', 'choice'), 'suggested_subject' (e.g. '算数', '国語', '理科', '社会', '英語'), and 'suggested_unit_id' (a short english identifier for the topic, e.g. 'fractions-addition', 'kanji', 'geometry').";

    let mut image_parts = Vec::new();
    for page in &result.pages {
        let image_path = data_dir.join(&page.image_path);
        let image_bytes = std::fs::read(&image_path)
            .map_err(|e| format!("failed to read page image {}: {}", image_path.display(), e))?;
        use base64::Engine;
        let base64_image = base64::engine::general_purpose::STANDARD.encode(&image_bytes);
        
        image_parts.push(serde_json::json!({ "text": format!("Page {}:", page.page) }));
        image_parts.push(serde_json::json!({
            "inline_data": {
                "mime_type": "image/png",
                "data": base64_image
            }
        }));
    }

    let raw_json = crate::ai_client::extract_with_ai(data_dir, image_parts, prompt).await?;
    let items = raw_json.as_array().ok_or("AI did not return a JSON array")?;

    let mut all_candidates = Vec::new();
    for item in items {
        let text = item["ocr_text"].as_str().unwrap_or("").trim().to_string();
        if text.is_empty() {
            continue;
        }
        let confidence = item["confidence"].as_f64().unwrap_or(1.0);
        let q_type = item["suggested_question_type"].as_str().unwrap_or("free-text").to_string();
        let subject = item["suggested_subject"].as_str().map(|s| s.to_string());
        let unit_id = item["suggested_unit_id"].as_str().map(|s| s.to_string());
        let page_num = item["page"].as_u64().unwrap_or(1) as u32;

        let candidate_id = format!("{}-p{:03}-c{:02}", source_document_id, page_num, all_candidates.len() + 1);

        all_candidates.push(CandidateResult {
            candidate_id,
            page: page_num,
            item_label: None,
            region: RegionRatio { x: 0.0, y: 0.0, width: 1.0, height: 1.0 },
            region_image_path: None,
            ocr_text: text,
            confidence: confidence as f32,
            suggested_question_type: q_type,
            suggested_subject: subject,
            suggested_unit_id: unit_id,
            review_status: "draft".to_string(),
        });
    }

    result.candidates = all_candidates;
    result.metrics.extraction_route = "ai-ocr".to_string();
    result.metrics.candidate_questions = result.candidates.len() as u32;

    let path = extraction_result_path(data_dir, source_document_id)?;
    let bytes = serde_json::to_vec_pretty(&result)
        .map_err(|e| format!("serialize extraction result: {}", e))?;
    std::fs::write(&path, bytes)
        .map_err(|e| format!("write extraction result {}: {}", path.display(), e))?;

    Ok(result)
}

/// Return the local review artifact path so the UI can make DATA_DIR storage visible.
pub fn extraction_result_path(
    data_dir: &Path,
    source_document_id: &str,
) -> Result<PathBuf, String> {
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
        return Err(format!(
            "unsupported candidate review status: {review_status}"
        ));
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

/// Validate that a `RegionRatio` is well-formed: all fields finite, x/y ≥ 0,
/// width/height > 0, and x+width / y+height ≤ 1.
fn validate_region(region: &RegionRatio) -> Result<(), String> {
    let RegionRatio {
        x,
        y,
        width,
        height,
    } = region;
    if !x.is_finite() || !y.is_finite() || !width.is_finite() || !height.is_finite() {
        return Err("region fields must be finite".to_owned());
    }
    if *x < 0.0 || *y < 0.0 {
        return Err("region x and y must be ≥ 0".to_owned());
    }
    if *width <= 0.0 || *height <= 0.0 {
        return Err("region width and height must be > 0".to_owned());
    }
    if x + width > 1.0 + f64::EPSILON {
        return Err(format!("region x+width ({}) must be ≤ 1", x + width));
    }
    if y + height > 1.0 + f64::EPSILON {
        return Err(format!("region y+height ({}) must be ≤ 1", y + height));
    }
    Ok(())
}

/// Merge an updated candidate back into the result, preserving fields that survive
/// region edits (currently `item_label`).
fn merge_reextracted_candidate(
    mut result: ExtractionResult,
    candidate_id: &str,
    mut updated: CandidateResult,
) -> Result<ExtractionResult, String> {
    let pos = result
        .candidates
        .iter()
        .position(|c| c.candidate_id == candidate_id)
        .ok_or_else(|| format!("candidate not found after re-extraction: {candidate_id}"))?;
    // item_label was derived from document structure (問1, ①, …), not from the OCR text
    // of a specific region, so it should survive region edits.
    updated.item_label = result.candidates[pos].item_label.clone();
    result.candidates[pos] = updated;
    Ok(result)
}

fn next_manual_candidate_id(result: &ExtractionResult, page: u32) -> String {
    let prefix = format!("{}-p{page:03}-m", result.source_document_id);
    let next = result
        .candidates
        .iter()
        .filter_map(|candidate| candidate.candidate_id.strip_prefix(&prefix))
        .filter_map(|suffix| suffix.parse::<u32>().ok())
        .max()
        .unwrap_or(0)
        + 1;
    format!("{prefix}{next:02}")
}

fn append_manual_candidate(
    mut result: ExtractionResult,
    candidate: CandidateResult,
) -> ExtractionResult {
    result.candidates.push(candidate);
    result.metrics.candidate_questions = result.candidates.len() as u32;
    result
}

/// Re-run OCR on a user-specified region for one candidate.
/// The worker emits a single CandidateResult JSON to stdout; this function
/// merges it into the existing extraction-result.json without touching other candidates.
pub async fn reextract_candidate_region(
    data_dir: &Path,
    source_document_id: &str,
    candidate_id: &str,
    region: &RegionRatio,
) -> Result<ExtractionResult, String> {
    validate_region(region)?;

    // Load existing result to get the page number for this candidate
    let mut result = load_extraction_result(data_dir, source_document_id)?;
    let page = result
        .candidates
        .iter()
        .find(|c| c.candidate_id == candidate_id)
        .map(|c| c.page)
        .ok_or_else(|| format!("candidate not found: {candidate_id}"))?;

    let mut command = worker_command();
    command
        .arg("--source-document")
        .arg(source_document_id)
        .arg("--data-dir")
        .arg(data_dir)
        .arg("--candidate-id")
        .arg(candidate_id)
        .arg("--page")
        .arg(page.to_string())
        .arg("--region")
        .arg(format!(
            "{},{},{},{}",
            region.x, region.y, region.width, region.height
        ))
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

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

    // Worker stdout is a single CandidateResult JSON
    let updated: CandidateResult = serde_json::from_slice(&output.stdout).map_err(|error| {
        let preview = String::from_utf8_lossy(&output.stdout);
        format!(
            "parse re-extraction result: {error}. stdout (first 200 chars): {}",
            &preview[..preview.len().min(200)]
        )
    })?;

    // Merge updated candidate into existing result, preserving item_label and other
    // fields that survive region edits.
    result = merge_reextracted_candidate(result, candidate_id, updated)?;

    let path = extraction_result_path(data_dir, source_document_id)?;
    let bytes = serde_json::to_vec_pretty(&result)
        .map_err(|error| format!("serialize extraction result: {error}"))?;
    std::fs::write(&path, bytes)
        .map_err(|error| format!("write extraction result {}: {error}", path.display()))?;

    Ok(result)
}

/// Re-extract a single candidate region using AI-OCR.
pub async fn reextract_candidate_with_ai(
    data_dir: &Path,
    source_document_id: &str,
    candidate_id: &str,
) -> Result<ExtractionResult, String> {
    let mut result = load_extraction_result(data_dir, source_document_id)?;
    let candidate = result.candidates.iter().find(|c| c.candidate_id == candidate_id)
        .ok_or_else(|| format!("candidate not found: {}", candidate_id))?;
    
    // Determine the image path to use
    let image_path = if let Some(ref rp) = candidate.region_image_path {
        data_dir.join(rp)
    } else {
        // Fallback to page image if region image isn't saved
        let page_result = result.pages.iter().find(|p| p.page == candidate.page)
            .ok_or_else(|| format!("page {} not found", candidate.page))?;
        data_dir.join(&page_result.image_path)
    };

    let image_bytes = std::fs::read(&image_path)
        .map_err(|e| format!("failed to read candidate image {}: {}", image_path.display(), e))?;
    use base64::Engine;
    use base64::engine::general_purpose;
    let base64_image = general_purpose::STANDARD.encode(&image_bytes);

    let prompt = "Extract the math or text problem from this image exactly as written. Return a JSON object with: 'ocr_text' (string) and 'confidence' (number).";

    let image_parts = vec![serde_json::json!({
        "inline_data": {
            "mime_type": "image/png",
            "data": base64_image
        }
    })];

    let json_res = crate::ai_client::extract_with_ai(data_dir, image_parts, prompt).await?;
    
    let updated = CandidateResult {
        candidate_id: candidate_id.to_string(),
        page: candidate.page,
        item_label: candidate.item_label.clone(),
        region: candidate.region.clone(),
        region_image_path: candidate.region_image_path.clone(),
        ocr_text: json_res["ocr_text"].as_str().unwrap_or(&candidate.ocr_text).to_string(),
        confidence: json_res["confidence"].as_f64().map(|c| c as f32).unwrap_or(candidate.confidence),
        suggested_question_type: candidate.suggested_question_type.clone(),
        suggested_subject: candidate.suggested_subject.clone(),
        suggested_unit_id: candidate.suggested_unit_id.clone(),
        review_status: candidate.review_status.clone(),
    };

    result = merge_reextracted_candidate(result, candidate_id, updated)?;

    let path = extraction_result_path(data_dir, source_document_id)?;
    let bytes = serde_json::to_vec_pretty(&result)
        .map_err(|e| format!("serialize extraction result: {}", e))?;
    std::fs::write(&path, bytes)
        .map_err(|e| format!("write extraction result {}: {}", path.display(), e))?;

    Ok(result)
}

/// Run OCR on a manually selected page region and append it as a new draft
/// candidate. This is the pre-review path used after raster-only import.
pub async fn ocr_source_region(
    data_dir: &Path,
    source_document_id: &str,
    page: u32,
    region: &RegionRatio,
) -> Result<ExtractionResult, String> {
    validate_region(region)?;

    let mut result = load_extraction_result(data_dir, source_document_id)?;
    if !result.pages.iter().any(|item| item.page == page) {
        return Err(format!("page not found in extraction result: {page}"));
    }
    let candidate_id = next_manual_candidate_id(&result, page);

    let mut command = worker_command();
    command
        .arg("--source-document")
        .arg(source_document_id)
        .arg("--data-dir")
        .arg(data_dir)
        .arg("--candidate-id")
        .arg(&candidate_id)
        .arg("--page")
        .arg(page.to_string())
        .arg("--region")
        .arg(format!(
            "{},{},{},{}",
            region.x, region.y, region.width, region.height
        ))
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

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

    let candidate: CandidateResult = serde_json::from_slice(&output.stdout).map_err(|error| {
        let preview = String::from_utf8_lossy(&output.stdout);
        format!(
            "parse manual region OCR result: {error}. stdout (first 200 chars): {}",
            &preview[..preview.len().min(200)]
        )
    })?;

    result = append_manual_candidate(result, candidate);
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

    Err(format!("invalid source document id: {source_document_id}"))
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

    // --- validate_region ---

    #[test]
    fn validate_region_accepts_full_page() {
        validate_region(&RegionRatio {
            x: 0.0,
            y: 0.0,
            width: 1.0,
            height: 1.0,
        })
        .expect("full-page region should be valid");
    }

    #[test]
    fn validate_region_accepts_interior_rect() {
        validate_region(&RegionRatio {
            x: 0.1,
            y: 0.2,
            width: 0.5,
            height: 0.4,
        })
        .expect("interior region should be valid");
    }

    #[test]
    fn validate_region_rejects_out_of_bounds() {
        let err = validate_region(&RegionRatio {
            x: 0.5,
            y: 0.0,
            width: 0.6,
            height: 1.0,
        })
        .expect_err("x+width > 1 should be rejected");
        assert!(
            err.contains("x+width"),
            "error should mention x+width, got: {err}"
        );
    }

    #[test]
    fn validate_region_rejects_zero_width() {
        let err = validate_region(&RegionRatio {
            x: 0.0,
            y: 0.0,
            width: 0.0,
            height: 0.5,
        })
        .expect_err("zero width should be rejected");
        assert!(
            err.contains("width"),
            "error should mention width, got: {err}"
        );
    }

    #[test]
    fn validate_region_rejects_negative_x() {
        let err = validate_region(&RegionRatio {
            x: -0.1,
            y: 0.0,
            width: 0.5,
            height: 0.5,
        })
        .expect_err("negative x should be rejected");
        assert!(err.contains('x') || err.contains("≥"), "got: {err}");
    }

    #[test]
    fn validate_region_rejects_nan() {
        let err = validate_region(&RegionRatio {
            x: f64::NAN,
            y: 0.0,
            width: 0.5,
            height: 0.5,
        })
        .expect_err("NaN should be rejected");
        assert!(err.contains("finite"), "got: {err}");
    }

    // --- merge_reextracted_candidate ---

    fn minimal_result_with_item_label() -> ExtractionResult {
        serde_json::from_str(
            r#"{
          "sourceDocumentId":"src","engine":"tesseract","engineVersion":"5",
          "language":"jpn","dpi":300,"generatedAtEpochSeconds":1,"pageCount":1,
          "pages":[],
          "candidates":[{
            "candidateId":"src-p001-c01","page":1,"itemLabel":"問1",
            "region":{"x":0,"y":0,"width":1,"height":1},
            "ocrText":"old","confidence":0.8,
            "suggestedQuestionType":"unknown","reviewStatus":"draft"
          }],
          "metrics":{"extractionRoute":"local-ocr","localOcrEngine":"tesseract",
            "pages":1,"candidateQuestions":1,"aiAssistedRegions":0,
            "adultCorrections":0,"elapsedMs":1,"estimatedApiCostUsd":0}
        }"#,
        )
        .expect("parse fixture")
    }

    #[test]
    fn merge_reextracted_candidate_preserves_item_label() {
        let result = minimal_result_with_item_label();
        let updated = CandidateResult {
            candidate_id: "src-p001-c01".to_owned(),
            page: 1,
            item_label: None, // worker does not set item_label
            region: RegionRatio {
                x: 0.1,
                y: 0.1,
                width: 0.8,
                height: 0.8,
            },
            region_image_path: None,
            ocr_text: "new text".to_owned(),
            confidence: 0.9,
            suggested_question_type: "unknown".to_owned(),
            review_status: "draft".to_owned(),
        };

        let merged = merge_reextracted_candidate(result, "src-p001-c01", updated)
            .expect("merge should succeed");

        assert_eq!(
            merged.candidates[0].item_label.as_deref(),
            Some("問1"),
            "item_label must be preserved from original candidate"
        );
        assert_eq!(
            merged.candidates[0].ocr_text, "new text",
            "ocr_text must be updated from the re-extraction"
        );
    }

    #[test]
    fn merge_reextracted_candidate_errors_if_not_found() {
        let result = minimal_result_with_item_label();
        let updated = CandidateResult {
            candidate_id: "nonexistent".to_owned(),
            page: 1,
            item_label: None,
            region: RegionRatio::default(),
            region_image_path: None,
            ocr_text: String::new(),
            confidence: 0.0,
            suggested_question_type: "unknown".to_owned(),
            review_status: "draft".to_owned(),
        };

        merge_reextracted_candidate(result, "nonexistent", updated)
            .expect_err("should error when candidate_id is not in result");
    }

    #[test]
    fn next_manual_candidate_id_increments_per_page() {
        let mut result = minimal_result_with_item_label();
        result.candidates.push(CandidateResult {
            candidate_id: "src-p001-m01".to_owned(),
            page: 1,
            item_label: None,
            region: RegionRatio {
                x: 0.0,
                y: 0.0,
                width: 1.0,
                height: 1.0,
            },
            region_image_path: None,
            ocr_text: "manual".to_owned(),
            confidence: 1.0,
            suggested_question_type: "unknown".to_owned(),
            review_status: "draft".to_owned(),
        });

        assert_eq!(next_manual_candidate_id(&result, 1), "src-p001-m02");
        assert_eq!(next_manual_candidate_id(&result, 2), "src-p002-m01");
    }

    #[test]
    fn append_manual_candidate_updates_candidate_count_metric() {
        let result = minimal_result_with_item_label();
        let appended = append_manual_candidate(
            result,
            CandidateResult {
                candidate_id: "src-p001-m01".to_owned(),
                page: 1,
                item_label: None,
                region: RegionRatio {
                    x: 0.0,
                    y: 0.0,
                    width: 1.0,
                    height: 1.0,
                },
                region_image_path: None,
                ocr_text: "manual".to_owned(),
                confidence: 1.0,
                suggested_question_type: "unknown".to_owned(),
                review_status: "draft".to_owned(),
            },
        );

        assert_eq!(appended.candidates.len(), 2);
        assert_eq!(appended.metrics.candidate_questions, 2);
    }
}
