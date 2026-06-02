use app_lib::{question_bank, source_document};

#[tokio::main]
async fn main() {
    let url = std::env::args()
        .nth(1)
        .expect("usage: cargo run --example import_pdf -- <PDF_URL>");
    let data_dir = question_bank::default_data_dir().expect("resolve DATA_DIR");
    let document = source_document::import_pdf_from_url(&data_dir, &url)
        .await
        .expect("import PDF");

    println!(
        "{}",
        serde_json::to_string_pretty(&document).expect("serialize imported SourceDocument")
    );
}
