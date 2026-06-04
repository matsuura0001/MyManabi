use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use reqwest::Client;

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AiProviderConfig {
    pub provider: String,
    pub api_key: String,
    pub model: String,
    #[serde(default)]
    pub base_url: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AiSettings {
    pub active_provider: String,
    pub providers: Vec<AiProviderConfig>,
}

impl Default for AiSettings {
    fn default() -> Self {
        Self {
            active_provider: "gemini".to_string(),
            providers: vec![
                AiProviderConfig {
                    provider: "gemini".to_string(),
                    api_key: "".to_string(),
                    model: "gemini-3-flash-preview".to_string(),
                    base_url: "https://generativelanguage.googleapis.com/v1beta/models".to_string(),
                },
                AiProviderConfig {
                    provider: "openai".to_string(),
                    api_key: "".to_string(),
                    model: "gpt-4o-mini".to_string(),
                    base_url: "https://api.openai.com/v1/chat/completions".to_string(),
                },
                AiProviderConfig {
                    provider: "anthropic".to_string(),
                    api_key: "".to_string(),
                    model: "claude-3-haiku-20240307".to_string(),
                    base_url: "https://api.anthropic.com/v1/messages".to_string(),
                },
            ],
        }
    }
}

pub fn get_ai_settings(data_dir: &Path) -> Result<AiSettings, String> {
    let path = data_dir.join("config").join("ai_settings.json");
    if !path.exists() {
        return Ok(AiSettings::default());
    }
    let content = fs::read_to_string(&path).map_err(|e| format!("failed to read ai_settings.json: {}", e))?;
    serde_json::from_str(&content).map_err(|e| format!("failed to parse ai_settings.json: {}", e))
}

pub fn save_ai_settings(data_dir: &Path, settings: &AiSettings) -> Result<(), String> {
    let dir = data_dir.join("config");
    fs::create_dir_all(&dir).map_err(|e| format!("failed to create config dir: {}", e))?;
    let path = dir.join("ai_settings.json");
    let content = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| format!("failed to write ai_settings.json: {}", e))
}

pub async fn run_gemini_extraction(
    api_key: &str,
    model: &str,
    base_url: &str,
    prompt: &str,
    image_parts: Vec<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let client = Client::new();
    let url = format!(
        "{}/{}:generateContent?key={}",
        base_url, model, api_key
    );

    let mut parts = vec![serde_json::json!({ "text": prompt })];
    parts.extend(image_parts);

    let body = serde_json::json!({
        "contents": [{
            "parts": parts
        }],
        "generationConfig": {
            "response_mime_type": "application/json"
        }
    });

    let res = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Gemini API request failed: {}", e))?;

    if !res.status().is_success() {
        let status = res.status();
        let error_text = res.text().await.unwrap_or_default();
        return Err(format!("Gemini API error ({}): {}", status, error_text));
    }

    let response_data: serde_json::Value = res
        .json()
        .await
        .map_err(|e| format!("Failed to parse Gemini API response: {}", e))?;

    let text = response_data["candidates"][0]["content"]["parts"][0]["text"]
        .as_str()
        .ok_or_else(|| "No text returned from Gemini".to_string())?;

    serde_json::from_str(text).map_err(|e| format!("Failed to parse JSON from Gemini text: {}", e))
}

pub async fn run_extraction(
    provider: &AiProviderConfig,
    prompt: &str,
    image_parts: Vec<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    if provider.api_key.trim().is_empty() {
        return Err(format!("API key for provider '{}' is not set.", provider.provider));
    }

    match provider.provider.as_str() {
        "gemini" => run_gemini_extraction(&provider.api_key, &provider.model, &provider.base_url, prompt, image_parts).await,
        other => Err(format!("Provider '{}' is not implemented yet.", other)),
    }
}

pub async fn extract_with_ai(
    data_dir: &Path,
    image_parts: Vec<serde_json::Value>,
    prompt: &str,
) -> Result<serde_json::Value, String> {
    let settings = get_ai_settings(data_dir)?;
    let provider = settings.providers.iter().find(|p| p.provider == settings.active_provider)
        .ok_or_else(|| "Active provider config not found".to_string())?;

    run_extraction(provider, prompt, image_parts).await
}
