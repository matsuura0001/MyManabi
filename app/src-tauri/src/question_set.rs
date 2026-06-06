use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::question_bank::{RegionRatio, Source};

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuestionSetMaterial {
    pub r#type: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub document_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub page: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub region: Option<RegionRatio>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub image_path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub media_id: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuestionSetItem {
    pub question_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    pub order: i32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub region_hint: Option<RegionRatio>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuestionSet {
    pub id: String,
    pub source: Source,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub question_materials: Vec<QuestionSetMaterial>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub answer_materials: Vec<QuestionSetMaterial>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub items: Vec<QuestionSetItem>,
}

pub fn load_question_sets(data_dir: &Path) -> Result<Vec<QuestionSet>, String> {
    let sets_dir = data_dir.join("content").join("question-sets");
    let entries = match fs::read_dir(&sets_dir) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(format!("read question sets {}: {error}", sets_dir.display())),
    };

    let mut paths = entries
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.extension().and_then(|value| value.to_str()) == Some("json"))
        .collect::<Vec<_>>();
    paths.sort();

    let mut question_sets = Vec::new();
    for path in paths {
        let text = fs::read_to_string(&path)
            .map_err(|error| format!("read question set {}: {error}", path.display()))?;
        let question_set: QuestionSet = serde_json::from_str(&text)
            .map_err(|error| format!("parse question set {}: {error}", path.display()))?;
        question_sets.push(question_set);
    }
    Ok(question_sets)
}

pub fn save_question_set(data_dir: &Path, question_set: &QuestionSet) -> Result<QuestionSet, String> {
    if question_set.id.is_empty() {
        return Err("question set id must not be empty".to_owned());
    }

    let sets_dir = data_dir.join("content").join("question-sets");
    fs::create_dir_all(&sets_dir)
        .map_err(|error| format!("create question sets dir {}: {error}", sets_dir.display()))?;
    
    let path = sets_dir.join(format!("{}.json", question_set.id));
    let bytes = serde_json::to_vec_pretty(question_set)
        .map_err(|error| format!("serialize question set {}: {error}", question_set.id))?;
    fs::write(&path, bytes)
        .map_err(|error| format!("write question set {}: {error}", path.display()))?;
    
    Ok(question_set.clone())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_data_dir() -> std::path::PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock should be after epoch")
            .as_nanos();
        std::env::temp_dir().join(format!("mymanabi-question-sets-{nonce}"))
    }

    #[test]
    fn saves_and_loads_question_set() {
        let data_dir = temp_data_dir();
        let question_set = QuestionSet {
            id: "set-001".to_owned(),
            source: Source {
                r#type: "imported".to_owned(),
                template_id: None,
                document_id: Some("doc-1".to_owned()),
                page: None,
                item_label: None,
            },
            question_materials: vec![],
            answer_materials: vec![],
            items: vec![QuestionSetItem {
                question_id: "q-1".to_owned(),
                label: Some("1".to_owned()),
                order: 1,
                region_hint: None,
            }],
        };

        save_question_set(&data_dir, &question_set).expect("save question set");
        let loaded = load_question_sets(&data_dir).expect("load question sets");
        
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].id, "set-001");

        std::fs::remove_dir_all(data_dir).expect("remove temp data dir");
    }
}
