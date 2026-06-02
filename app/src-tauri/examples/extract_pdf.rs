//! Headless proof that the OCR worker driver works without launching the GUI.
//!
//! Prerequisites:
//!   1. A stored SourceDocument: `cargo run --example import_pdf -- <PDF_URL>`
//!      (or place a PDF + `<DATA_DIR>/content/source-documents/<id>.json` by hand).
//!   2. A built worker: `dotnet build -c Release` in `tools/ocr-worker`
//!      (or set MYMANABI_OCR_WORKER to the executable).
//!   3. Japanese tessdata: `tools/ocr-worker/scripts/get-tessdata.ps1`.
//!
//! Usage:
//!   cargo run --example extract_pdf -- <SOURCE_DOCUMENT_ID>

use app_lib::{ocr_worker, question_bank};

#[tokio::main]
async fn main() {
    let source_document_id = std::env::args()
        .nth(1)
        .expect("usage: cargo run --example extract_pdf -- <SOURCE_DOCUMENT_ID>");
    let data_dir = question_bank::default_data_dir().expect("resolve DATA_DIR");

    let result = ocr_worker::extract_source_document(
        &data_dir,
        &source_document_id,
        &ocr_worker::ExtractionOptions::default(),
    )
    .await
    .expect("extract source document");

    println!(
        "{}",
        serde_json::to_string_pretty(&result).expect("serialize extraction result")
    );
}
