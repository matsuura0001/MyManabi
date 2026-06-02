//! Store imported source documents under DATA_DIR without committing source content.

use serde::{Deserialize, Serialize};
use std::{
    fs,
    net::IpAddr,
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};

const MAX_PDF_BYTES: usize = 25 * 1024 * 1024;

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
        .is_some_and(|length| length > MAX_PDF_BYTES as u64)
    {
        return Err(format!("PDF exceeds {} bytes", MAX_PDF_BYTES));
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
    if bytes.len() > MAX_PDF_BYTES {
        return Err(format!("PDF exceeds {} bytes", MAX_PDF_BYTES));
    }
    if !bytes.starts_with(b"%PDF-") {
        return Err("downloaded file is not a PDF".to_owned());
    }

    let imported_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("system clock: {error}"))?;
    let imported_at_epoch_seconds = imported_at.as_secs();
    let stem = sanitize_stem(original_file_name);
    let id = format!("{stem}-{}", imported_at.as_millis());
    let stored_path = format!("sources/{id}.pdf");
    let document = SourceDocument {
        id: id.clone(),
        kind: "pdf".to_owned(),
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
    fs::write(&source_path, bytes).map_err(|error| format!("store PDF: {error}"))?;
    fs::write(
        &metadata_path,
        serde_json::to_vec_pretty(&document)
            .map_err(|error| format!("serialize source document: {error}"))?,
    )
    .map_err(|error| format!("store source document metadata: {error}"))?;

    Ok(document)
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

fn sanitize_stem(file_name: &str) -> String {
    let stem = file_name
        .strip_suffix(".pdf")
        .or_else(|| file_name.strip_suffix(".PDF"))
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
        "imported-pdf".to_owned()
    } else {
        sanitized.to_owned()
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

        assert_eq!(error, "downloaded file is not a PDF");
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
