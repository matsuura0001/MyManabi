//! Store imported source documents under DATA_DIR without committing source content.

use serde::{Deserialize, Serialize};
use std::{
    fs,
    net::IpAddr,
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};

const MAX_SOURCE_BYTES: usize = 25 * 1024 * 1024;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceDocument {
    pub id: String,
    pub kind: String,
    pub original_file_name: String,
    pub stored_path: String,
    pub source_url: Option<String>,
    pub imported_at_epoch_seconds: u64,
    pub byte_size: usize,
    pub status: String,
    pub extraction_status: String,
}

pub async fn import_pdf_from_url(data_dir: &Path, url: &str) -> Result<SourceDocument, String> {
    let url = reqwest::Url::parse(url).map_err(|error| format!("parse PDF URL: {error}"))?;
    validate_public_https_url(&url)?;
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::custom(|attempt| {
            if validate_public_https_url(attempt.url()).is_ok() {
                attempt.follow()
            } else {
                attempt.stop()
            }
        }))
        .build()
        .map_err(|error| format!("create HTTP client: {error}"))?;

    let response = client
        .get(url)
        .send()
        .await
        .map_err(|error| format!("download PDF: {error}"))?
        .error_for_status()
        .map_err(|error| format!("download PDF: {error}"))?;
    validate_public_https_url(response.url())?;
    if response
        .content_length()
        .is_some_and(|length| length > MAX_SOURCE_BYTES as u64)
    {
        return Err(format!("PDF exceeds {} bytes", MAX_SOURCE_BYTES));
    }

    let final_url = response.url().to_string();
    let original_file_name = response
        .url()
        .path_segments()
        .and_then(|segments| segments.last())
        .filter(|name| !name.is_empty())
        .unwrap_or("imported.pdf")
        .to_owned();
    let bytes = response
        .bytes()
        .await
        .map_err(|error| format!("read downloaded PDF: {error}"))?;

    store_pdf(data_dir, &original_file_name, Some(final_url), &bytes)
}

pub fn store_pdf(
    data_dir: &Path,
    original_file_name: &str,
    source_url: Option<String>,
    bytes: &[u8],
) -> Result<SourceDocument, String> {
    store_source(data_dir, original_file_name, source_url, bytes)
}

pub fn import_source_from_path(data_dir: &Path, path: &Path) -> Result<SourceDocument, String> {
    let original_file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "selected source file has no UTF-8 file name".to_owned())?;
    let bytes = fs::read(path).map_err(|error| format!("read selected source file: {error}"))?;
    store_source(data_dir, original_file_name, None, &bytes)
}

pub fn list_source_documents(data_dir: &Path) -> Result<Vec<SourceDocument>, String> {
    let metadata_dir = data_dir.join("content").join("source-documents");
    let entries = match fs::read_dir(&metadata_dir) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => {
            return Err(format!(
                "read source documents {}: {error}",
                metadata_dir.display()
            ));
        }
    };
    let mut documents = Vec::new();
    for entry in entries.filter_map(Result::ok) {
        let path = entry.path();
        if path.extension().and_then(|extension| extension.to_str()) != Some("json") {
            continue;
        }
        let bytes = fs::read(&path)
            .map_err(|error| format!("read source document {}: {error}", path.display()))?;
        let document: SourceDocument = serde_json::from_slice(&bytes)
            .map_err(|error| format!("parse source document {}: {error}", path.display()))?;
        documents.push(document);
    }
    documents.sort_by_key(|document| std::cmp::Reverse(document.imported_at_epoch_seconds));
    Ok(documents)
}

pub fn store_source(
    data_dir: &Path,
    original_file_name: &str,
    source_url: Option<String>,
    bytes: &[u8],
) -> Result<SourceDocument, String> {
    if bytes.is_empty() {
        return Err("source file is empty".to_owned());
    }
    if bytes.len() > MAX_SOURCE_BYTES {
        return Err(format!("source file exceeds {} bytes", MAX_SOURCE_BYTES));
    }
    let (kind, extension) = validate_source(original_file_name, bytes)?;

    let imported_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("system clock: {error}"))?;
    let imported_at_epoch_seconds = imported_at.as_secs();
    let stem = sanitize_stem(original_file_name);
    let id = format!("{stem}-{}", imported_at.as_millis());
    let stored_path = format!("sources/{id}.{extension}");
    let document = SourceDocument {
        id: id.clone(),
        kind: kind.to_owned(),
        original_file_name: original_file_name.to_owned(),
        stored_path: stored_path.clone(),
        source_url,
        imported_at_epoch_seconds,
        byte_size: bytes.len(),
        status: "stored".to_owned(),
        extraction_status: "pending-review".to_owned(),
    };

    let source_path = data_dir.join(&stored_path);
    let metadata_path = data_dir
        .join("content")
        .join("source-documents")
        .join(format!("{id}.json"));
    fs::create_dir_all(
        source_path
            .parent()
            .ok_or_else(|| "source path has no parent".to_owned())?,
    )
    .map_err(|error| format!("create source directory: {error}"))?;
    fs::create_dir_all(
        metadata_path
            .parent()
            .ok_or_else(|| "metadata path has no parent".to_owned())?,
    )
    .map_err(|error| format!("create metadata directory: {error}"))?;
    fs::write(&source_path, bytes).map_err(|error| format!("store source file: {error}"))?;
    fs::write(
        &metadata_path,
        serde_json::to_vec_pretty(&document)
            .map_err(|error| format!("serialize source document: {error}"))?,
    )
    .map_err(|error| format!("store source document metadata: {error}"))?;

    Ok(document)
}

pub fn delete_source_document(data_dir: &Path, id: &str) -> Result<crate::question_bank::DeleteResult, String> {
    let metadata_path = data_dir
        .join("content")
        .join("source-documents")
        .join(format!("{}.json", id));

    if !metadata_path.exists() {
        return Ok(crate::question_bank::DeleteResult { deleted_count: 0, invalidated_count: 0 });
    }

    let bytes = fs::read(&metadata_path)
        .map_err(|error| format!("read source document metadata: {error}"))?;
    let document: SourceDocument = serde_json::from_slice(&bytes)
        .map_err(|error| format!("parse source document metadata: {error}"))?;

    // Delete related questions or invalidate them
    let delete_result = crate::question_bank::delete_or_invalidate_questions_by_source(data_dir, id)?;

    // Delete the source file (e.g. PDF/Image)
    let source_path = data_dir.join(&document.stored_path);
    if source_path.exists() {
        fs::remove_file(&source_path).unwrap_or_else(|e| {
            eprintln!("Failed to remove source file {}: {}", source_path.display(), e);
        });
    }

    // Delete extractions directory if it exists
    let extractions_dir = data_dir.join("content").join("extractions").join(id);
    if extractions_dir.exists() {
        fs::remove_dir_all(&extractions_dir).unwrap_or_else(|e| {
            eprintln!("Failed to remove extractions dir {}: {}", extractions_dir.display(), e);
        });
    }

    // Finally delete the metadata json
    fs::remove_file(&metadata_path)
        .map_err(|error| format!("delete source document metadata: {error}"))?;

    Ok(delete_result)
}

fn validate_source(file_name: &str, bytes: &[u8]) -> Result<(&'static str, &'static str), String> {
    let extension = Path::new(file_name)
        .extension()
        .and_then(|extension| extension.to_str())
        .map(str::to_ascii_lowercase)
        .ok_or_else(|| "source file must have an extension".to_owned())?;

    match extension.as_str() {
        "pdf" if bytes.starts_with(b"%PDF-") => Ok(("pdf", "pdf")),
        "png" if bytes.starts_with(b"\x89PNG\r\n\x1a\n") => Ok(("image", "png")),
        "jpg" | "jpeg" if bytes.starts_with(b"\xff\xd8\xff") => Ok(("image", "jpg")),
        "webp" if bytes.len() >= 12 && bytes.starts_with(b"RIFF") && &bytes[8..12] == b"WEBP" => {
            Ok(("image", "webp"))
        }
        "txt" | "md" if std::str::from_utf8(bytes).is_ok() => {
            Ok(("text", extension_label(&extension)))
        }
        "pdf" => Err("selected file is not a PDF".to_owned()),
        "png" | "jpg" | "jpeg" | "webp" => Err("selected file is not a supported image".to_owned()),
        "txt" | "md" => Err("text source must use UTF-8".to_owned()),
        _ => Err("supported source types: PDF, PNG, JPEG, WebP, TXT, Markdown".to_owned()),
    }
}

fn extension_label(extension: &str) -> &'static str {
    if extension == "md" {
        "md"
    } else {
        "txt"
    }
}

fn sanitize_stem(file_name: &str) -> String {
    let stem = Path::new(file_name)
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or(file_name);
    let sanitized = stem
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '-' | '_') {
                character
            } else {
                '-'
            }
        })
        .collect::<String>();
    let sanitized = sanitized.trim_matches('-');
    if sanitized.is_empty() {
        "imported-source".to_owned()
    } else {
        sanitized.to_owned()
    }
}

fn validate_public_https_url(url: &reqwest::Url) -> Result<(), String> {
    if url.scheme() != "https" {
        return Err("PDF URL must use https://".to_owned());
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err("PDF URL must not include credentials".to_owned());
    }
    let host = url
        .host_str()
        .ok_or_else(|| "PDF URL has no host".to_owned())?;
    if host.eq_ignore_ascii_case("localhost") || host.ends_with(".localhost") {
        return Err("PDF URL must use a public host".to_owned());
    }
    match host.parse::<IpAddr>() {
        Ok(IpAddr::V4(address))
            if address.is_private()
                || address.is_loopback()
                || address.is_link_local()
                || address.is_unspecified() =>
        {
            Err("PDF URL must use a public host".to_owned())
        }
        Ok(IpAddr::V6(address))
            if address.is_loopback()
                || address.is_unicast_link_local()
                || address.is_unique_local()
                || address.is_unspecified() =>
        {
            Err("PDF URL must use a public host".to_owned())
        }
        _ => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_data_dir() -> std::path::PathBuf {
        std::env::temp_dir().join(format!(
            "mymanabi-source-document-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("clock after epoch")
                .as_nanos()
        ))
    }

    #[test]
    fn stores_pdf_and_metadata_under_data_dir() {
        let data_dir = temp_data_dir();
        let document = store_pdf(
            &data_dir,
            "kanji 4.pdf",
            Some("https://example.invalid/kanji%204.pdf".to_owned()),
            b"%PDF-1.4\n%%EOF",
        )
        .expect("store synthetic PDF");

        assert_eq!(document.extraction_status, "pending-review");
        assert!(data_dir.join(&document.stored_path).exists());
        assert!(data_dir
            .join("content")
            .join("source-documents")
            .join(format!("{}.json", document.id))
            .exists());
        fs::remove_dir_all(data_dir).expect("remove temp DATA_DIR");
    }

    #[test]
    fn rejects_non_pdf_file() {
        let error = store_pdf(&temp_data_dir(), "fake.pdf", None, b"not a PDF")
            .expect_err("reject non-PDF file");

        assert_eq!(error, "selected file is not a PDF");
    }

    #[test]
    fn stores_utf8_text_source() {
        let data_dir = temp_data_dir();
        let document = store_source(&data_dir, "notes.md", None, "問1 たし算".as_bytes())
            .expect("store UTF-8 text");

        assert_eq!(document.kind, "text");
        assert!(document.stored_path.ends_with(".md"));
        fs::remove_dir_all(data_dir).expect("remove temp DATA_DIR");
    }

    #[test]
    fn stores_png_image_source() {
        let data_dir = temp_data_dir();
        let document = store_source(
            &data_dir,
            "worksheet.png",
            None,
            b"\x89PNG\r\n\x1a\nsynthetic",
        )
        .expect("store PNG image");

        assert_eq!(document.kind, "image");
        assert!(document.stored_path.ends_with(".png"));
        fs::remove_dir_all(data_dir).expect("remove temp DATA_DIR");
    }

    #[test]
    fn lists_source_documents_newest_first() {
        let data_dir = temp_data_dir();
        store_source(&data_dir, "first.txt", None, b"first").expect("store first");
        store_source(&data_dir, "second.txt", None, b"second").expect("store second");

        let documents = list_source_documents(&data_dir).expect("list source documents");

        assert_eq!(documents.len(), 2);
        assert!(documents
            .iter()
            .any(|document| document.original_file_name == "first.txt"));
        assert!(documents
            .iter()
            .any(|document| document.original_file_name == "second.txt"));
        fs::remove_dir_all(data_dir).expect("remove temp DATA_DIR");
    }

    #[test]
    fn rejects_local_pdf_url() {
        let url = reqwest::Url::parse("https://127.0.0.1/private.pdf").expect("parse URL");

        assert_eq!(
            validate_public_https_url(&url).expect_err("reject loopback URL"),
            "PDF URL must use a public host"
        );
    }

    #[test]
    fn accepts_public_pdf_url() {
        let url = reqwest::Url::parse("https://share.google/example").expect("parse URL");

        validate_public_https_url(&url).expect("accept public HTTPS URL");
    }
}
