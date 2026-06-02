use crate::question_bank::Question;

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
}
