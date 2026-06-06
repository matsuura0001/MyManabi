use chrono::{DateTime, Utc, Local};
use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::Path;

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
pub struct LearningEvent {
    pub schema_version: u32,
    pub event_id: String,
    pub occurred_at: DateTime<Utc>,
    pub learner_id: String,
    pub unit: String,
    pub template_id: String,
    pub question: String,
    pub response: EventResponse,
    pub grading: EventGrading,
    pub duration_seconds: u32,
    pub flags: EventFlags,
    pub explanations: Vec<String>,
    pub adult_review_required: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
pub struct EventResponse {
    pub r#type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub choice_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub media_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
pub struct EventGrading {
    pub result: String,
    pub method: String,
    pub reason: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
pub struct EventFlags {
    pub did_not_know: bool,
    pub disputed: bool,
    pub anxious: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TodayLearningStats {
    pub attempted: usize,
    pub correct: usize,
    pub incorrect: usize,
    pub unknown: usize,
    pub disputed: usize,
}

pub fn record_learning_event(data_dir: &Path, event: &LearningEvent) -> Result<(), String> {
    crate::domain::validate_learner_id(&event.learner_id)?;
    crate::question_bank::validate_question_id(&event.question)?;

    let events_dir = data_dir
        .join("learners")
        .join(&event.learner_id)
        .join("events");
    
    fs::create_dir_all(&events_dir)
        .map_err(|e| format!("failed to create events dir: {}", e))?;

    let today = Local::now().format("%Y-%m-%d").to_string();
    let file_path = events_dir.join(format!("{}.jsonl", today));

    let json_line = serde_json::to_string(event)
        .map_err(|e| format!("failed to serialize event: {}", e))?;

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&file_path)
        .map_err(|e| format!("failed to open events file {}: {}", file_path.display(), e))?;

    writeln!(file, "{}", json_line)
        .map_err(|e| format!("failed to write to events file: {}", e))?;

    Ok(())
}

pub fn get_today_learning_stats(data_dir: &Path, learner_id: &str) -> Result<TodayLearningStats, String> {
    crate::domain::validate_learner_id(learner_id)?;

    let today = Local::now().format("%Y-%m-%d").to_string();
    let file_path = data_dir
        .join("learners")
        .join(learner_id)
        .join("events")
        .join(format!("{}.jsonl", today));

    let mut stats = TodayLearningStats {
        attempted: 0,
        correct: 0,
        incorrect: 0,
        unknown: 0,
        disputed: 0,
    };

    if !file_path.exists() {
        return Ok(stats);
    }

    let file = fs::File::open(&file_path)
        .map_err(|e| format!("failed to open events file {}: {}", file_path.display(), e))?;
    let reader = std::io::BufReader::new(file);

    for line in std::io::BufRead::lines(reader) {
        if let Ok(line_str) = line {
            if line_str.trim().is_empty() {
                continue;
            }
            if let Ok(event) = serde_json::from_str::<LearningEvent>(&line_str) {
                stats.attempted += 1;
                match event.grading.result.as_str() {
                    "correct" => stats.correct += 1,
                    "incorrect" => stats.incorrect += 1,
                    _ => {}
                }
                if event.flags.did_not_know {
                    stats.unknown += 1;
                }
                if event.flags.disputed {
                    stats.disputed += 1;
                }
            }
        }
    }

    Ok(stats)
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
        std::env::temp_dir().join(format!("mymanabi-learning-event-{nonce}"))
    }

    #[test]
    fn records_learning_event_to_jsonl() {
        let data_dir = temp_data_dir();
        let event = LearningEvent {
            schema_version: 2,
            event_id: "evt-001".to_string(),
            occurred_at: Utc::now(),
            learner_id: "learner-a".to_string(),
            unit: "fraction-addition".to_string(),
            template_id: "tmp-1".to_string(),
            question: "q-001".to_string(),
            response: EventResponse {
                r#type: "text".to_string(),
                text: Some("3/4".to_string()),
                choice_id: None,
                media_id: None,
                reason: None,
            },
            grading: EventGrading {
                result: "unknown".to_string(),
                method: "not-graded".to_string(),
                reason: "".to_string(),
            },
            duration_seconds: 15,
            flags: EventFlags {
                did_not_know: false,
                disputed: false,
                anxious: false,
            },
            explanations: vec![],
            adult_review_required: false,
        };

        record_learning_event(&data_dir, &event).expect("record event");

        let today = Local::now().format("%Y-%m-%d").to_string();
        let file_path = data_dir
            .join("learners")
            .join("learner-a")
            .join("events")
            .join(format!("{}.jsonl", today));
        
        assert!(file_path.exists());
        let content = fs::read_to_string(&file_path).expect("read events file");
        assert!(content.contains("evt-001"));
        assert!(content.contains("learner_id")); // snake_case is preserved
        assert!(content.contains("learner-a"));

        let _ = fs::remove_dir_all(data_dir);
    }
}
