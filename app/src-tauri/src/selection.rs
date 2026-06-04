use crate::question_bank::Question;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SelectionDecision {
    pub pattern_id: String,
    pub pattern_version: u32,
    pub selected_question_id: String,
    pub selected_at: DateTime<Utc>,
    pub reason: String,
    pub priority_snapshot: serde_json::Value,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct QuestionQueueItem {
    pub learner_id: String,
    pub question_id: String,
    pub priority_snapshot: serde_json::Value,
    pub calculated_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

pub fn rank_questions_by_weight<F>(questions: Vec<Question>, mut weight_for: F) -> Vec<Question>
where
    F: FnMut(&Question) -> i32,
{
    let mut weighted = questions
        .into_iter()
        .map(|question| (weight_for(&question), question))
        .collect::<Vec<_>>();

    weighted.sort_by(|(left_weight, left), (right_weight, right)| {
        right_weight
            .cmp(left_weight)
            .then_with(|| left.id.cmp(&right.id))
    });

    weighted.into_iter().map(|(_, question)| question).collect()
}

pub fn build_question_queue(
    learner_id: &str,
    ranked_questions: Vec<Question>,
) -> Vec<QuestionQueueItem> {
    let now = Utc::now();
    let expires_at = now + chrono::Duration::hours(4);
    
    ranked_questions
        .into_iter()
        .map(|q| QuestionQueueItem {
            learner_id: learner_id.to_string(),
            question_id: q.id,
            priority_snapshot: serde_json::json!({ "total": 0 }), // Placeholder for actual priority logic
            calculated_at: now,
            expires_at,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::question_bank::load_approved_questions;
    use std::path::PathBuf;

    #[test]
    fn ranks_questions_using_in_memory_weights() {
        let data_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("..")
            .join("examples")
            .join("data-dir");
        let questions = load_approved_questions(&data_dir).expect("load synthetic questions");

        let ranked = rank_questions_by_weight(questions, |question| {
            if question.id == "synthetic-fraction-story-01" {
                10
            } else {
                0
            }
        });

        assert_eq!(ranked[0].id, "synthetic-fraction-story-01");
    }

    #[test]
    fn builds_queue_from_ranked_questions() {
        let data_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("..")
            .join("examples")
            .join("data-dir");
        let questions = load_approved_questions(&data_dir).expect("load synthetic questions");
        
        let queue = build_question_queue("learner-test", questions);
        assert!(!queue.is_empty());
        assert_eq!(queue[0].learner_id, "learner-test");
    }
}
