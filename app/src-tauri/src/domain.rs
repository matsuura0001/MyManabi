use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Skill {
    pub id: String,
    pub unit_id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub prerequisite_skill_ids: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LearnerSkillState {
    pub learner_id: String,
    pub skill_id: String,
    pub attempts: u32,
    pub correct_count: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_reviewed_at: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub learning_curve: Option<LearningCurve>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub forgetting_curve: Option<ForgettingCurve>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LearnerQuestionState {
    pub learner_id: String,
    pub question_id: String,
    pub attempts: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_presented_at: Option<DateTime<Utc>>,
    pub disputed_count: u32,
    pub status: String, // "active", "suspended", "invalidated"
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum LearningCurve {
    Power {
        initial_value: f64,
        exponent: f64,
    },
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ForgettingCurve {
    Power {
        initial_retention: f64,
        decay_rate: f64,
    },
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Learner {
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon_url: Option<String>,
}

pub fn validate_learner_id(learner_id: &str) -> Result<(), String> {
    if learner_id.is_empty() {
        return Err("learner id cannot be empty".to_string());
    }
    if !learner_id.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-') {
        return Err(format!("invalid learner id format: {}", learner_id));
    }
    if !learner_id.chars().next().unwrap().is_ascii_alphanumeric() {
        return Err(format!("learner id must start with alphanumeric: {}", learner_id));
    }
    Ok(())
}

/// Load learner's profile
pub fn load_learner(data_dir: &Path, learner_id: &str) -> Result<Learner, String> {
    validate_learner_id(learner_id)?;
    let path = data_dir.join("learners").join(learner_id).join("profile.json");
    let text = fs::read_to_string(&path)
        .map_err(|e| format!("failed to read learner {}: {}", learner_id, e))?;
    serde_json::from_str(&text).map_err(|e| format!("failed to parse learner profile: {}", e))
}

/// List all learners in the DATA_DIR
pub fn list_learners(data_dir: &Path) -> Result<Vec<Learner>, String> {
    let dir = data_dir.join("learners");
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let entries = fs::read_dir(&dir)
        .map_err(|e| format!("failed to read learners dir: {}", e))?;
    
    let mut learners = Vec::new();
    for entry in entries.filter_map(Result::ok) {
        if entry.path().is_dir() {
            if let Some(name) = entry.file_name().to_str() {
                if let Ok(learner) = load_learner(data_dir, name) {
                    learners.push(learner);
                }
            }
        }
    }
    
    // Sort by id for determinism
    learners.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(learners)
}

/// Save learner's profile
pub fn save_learner(data_dir: &Path, learner: &Learner) -> Result<(), String> {
    validate_learner_id(&learner.id)?;
    let dir = data_dir.join("learners").join(&learner.id);
    fs::create_dir_all(&dir).map_err(|e| format!("failed to create learner dir: {}", e))?;
    let path = dir.join("profile.json");
    let bytes = serde_json::to_vec_pretty(learner)
        .map_err(|e| format!("failed to serialize learner: {}", e))?;
    fs::write(&path, bytes).map_err(|e| format!("failed to write learner profile: {}", e))
}

pub fn load_learner_skill_state(
    data_dir: &Path,
    learner_id: &str,
    skill_id: &str,
) -> Result<LearnerSkillState, String> {
    validate_learner_id(learner_id)?;
    // Assuming skill_id uses same format validation as question_id or learner_id
    crate::question_bank::validate_question_id(skill_id).map_err(|e| format!("invalid skill id: {}", e))?;
    
    let path = data_dir
        .join("learners")
        .join(learner_id)
        .join("state")
        .join("skills")
        .join(format!("{}.json", skill_id));
    
    if !path.exists() {
        // Return default state if not exists
        return Ok(LearnerSkillState {
            learner_id: learner_id.to_string(),
            skill_id: skill_id.to_string(),
            attempts: 0,
            correct_count: 0,
            last_reviewed_at: None,
            learning_curve: None,
            forgetting_curve: None,
        });
    }

    let text = fs::read_to_string(&path)
        .map_err(|e| format!("failed to read skill state: {}", e))?;
    serde_json::from_str(&text).map_err(|e| format!("failed to parse skill state: {}", e))
}

pub fn save_learner_skill_state(
    data_dir: &Path,
    state: &LearnerSkillState,
) -> Result<(), String> {
    validate_learner_id(&state.learner_id)?;
    crate::question_bank::validate_question_id(&state.skill_id).map_err(|e| format!("invalid skill id: {}", e))?;

    let dir = data_dir
        .join("learners")
        .join(&state.learner_id)
        .join("state")
        .join("skills");
    fs::create_dir_all(&dir).map_err(|e| format!("failed to create skill state dir: {}", e))?;
    let path = dir.join(format!("{}.json", state.skill_id));
    let bytes = serde_json::to_vec_pretty(state)
        .map_err(|e| format!("failed to serialize skill state: {}", e))?;
    fs::write(&path, bytes).map_err(|e| format!("failed to write skill state: {}", e))
}

pub fn load_learner_question_state(
    data_dir: &Path,
    learner_id: &str,
    question_id: &str,
) -> Result<LearnerQuestionState, String> {
    validate_learner_id(learner_id)?;
    crate::question_bank::validate_question_id(question_id)?;

    let path = data_dir
        .join("learners")
        .join(learner_id)
        .join("state")
        .join("questions")
        .join(format!("{}.json", question_id));
    
    if !path.exists() {
        return Ok(LearnerQuestionState {
            learner_id: learner_id.to_string(),
            question_id: question_id.to_string(),
            attempts: 0,
            last_presented_at: None,
            disputed_count: 0,
            status: "active".to_string(),
        });
    }

    let text = fs::read_to_string(&path)
        .map_err(|e| format!("failed to read question state: {}", e))?;
    serde_json::from_str(&text).map_err(|e| format!("failed to parse question state: {}", e))
}

pub fn save_learner_question_state(
    data_dir: &Path,
    state: &LearnerQuestionState,
) -> Result<(), String> {
    validate_learner_id(&state.learner_id)?;
    crate::question_bank::validate_question_id(&state.question_id)?;

    let dir = data_dir
        .join("learners")
        .join(&state.learner_id)
        .join("state")
        .join("questions");
    fs::create_dir_all(&dir).map_err(|e| format!("failed to create question state dir: {}", e))?;
    let path = dir.join(format!("{}.json", state.question_id));
    let bytes = serde_json::to_vec_pretty(state)
        .map_err(|e| format!("failed to serialize question state: {}", e))?;
    fs::write(&path, bytes).map_err(|e| format!("failed to write question state: {}", e))
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_data_dir() -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock should be after epoch")
            .as_nanos();
        std::env::temp_dir().join(format!("mymanabi-domain-{nonce}"))
    }

    #[test]
    fn saves_and_loads_learner() {
        let data_dir = temp_data_dir();
        let learner = Learner {
            id: "learner-a".to_string(),
            name: "Learner A".to_string(),
            icon_url: Some("icon.png".to_string()),
        };

        save_learner(&data_dir, &learner).expect("save learner");
        let loaded = load_learner(&data_dir, "learner-a").expect("load learner");
        assert_eq!(learner, loaded);

        fs::remove_dir_all(data_dir).expect("remove temp data dir");
    }

    #[test]
    fn saves_and_loads_skill_state() {
        let data_dir = temp_data_dir();
        let state = LearnerSkillState {
            learner_id: "learner-a".to_string(),
            skill_id: "fraction-addition-same-denominator".to_string(),
            attempts: 8,
            correct_count: 6,
            last_reviewed_at: Some(Utc::now()),
            learning_curve: Some(LearningCurve::Power {
                initial_value: 1.0,
                exponent: -0.25,
            }),
            forgetting_curve: Some(ForgettingCurve::Power {
                initial_retention: 1.0,
                decay_rate: 0.35,
            }),
        };

        save_learner_skill_state(&data_dir, &state).expect("save skill state");
        let loaded = load_learner_skill_state(&data_dir, "learner-a", "fraction-addition-same-denominator").expect("load skill state");
        assert_eq!(state, loaded);

        fs::remove_dir_all(data_dir).expect("remove temp data dir");
    }

    #[test]
    fn returns_default_skill_state_if_not_exists() {
        let data_dir = temp_data_dir();
        let loaded = load_learner_skill_state(&data_dir, "learner-a", "unknown-skill").expect("load default skill state");
        assert_eq!(loaded.attempts, 0);
        assert_eq!(loaded.skill_id, "unknown-skill");
        let _ = fs::remove_dir_all(data_dir);
    }

    #[test]
    fn saves_and_loads_question_state() {
        let data_dir = temp_data_dir();
        let state = LearnerQuestionState {
            learner_id: "learner-a".to_string(),
            question_id: "q-001".to_string(),
            attempts: 2,
            last_presented_at: Some(Utc::now()),
            disputed_count: 0,
            status: "active".to_string(),
        };

        save_learner_question_state(&data_dir, &state).expect("save question state");
        let loaded = load_learner_question_state(&data_dir, "learner-a", "q-001").expect("load question state");
        assert_eq!(state, loaded);

        fs::remove_dir_all(data_dir).expect("remove temp data dir");
    }
}
