use crate::codex::ProposedItem;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AnswerSplitEvaluationCase {
    pub id: String,
    pub source_document_id: Option<String>,
    pub question_set_id: Option<String>,
    pub input_text: String,
    pub expected_item_count: usize,
    pub rule_output: Vec<ProposedItem>,
    pub ai_output: Vec<ProposedItem>,
    pub final_items: Vec<ProposedItem>,
    pub status: String, // "accepted", "corrected", "failed"
}

pub fn save_answer_split_evaluation(
    data_dir: &Path,
    case: &AnswerSplitEvaluationCase,
) -> Result<(), String> {
    let dir = data_dir.join("content").join("evaluations").join("answer-splits");
    fs::create_dir_all(&dir)
        .map_err(|e| format!("failed to create dir {}: {e}", dir.display()))?;

    let file_path = dir.join(format!("{}.json", case.id));
    let json_bytes = serde_json::to_vec_pretty(case)
        .map_err(|e| format!("failed to serialize answer split evaluation: {e}"))?;

    fs::write(&file_path, json_bytes)
        .map_err(|e| format!("failed to write {}: {e}", file_path.display()))?;

    Ok(())
}
