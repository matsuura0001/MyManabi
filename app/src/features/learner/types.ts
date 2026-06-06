import type { Question } from "../../domain/question";
import type { QuestionSet } from "../../domain/questionSet";
import type { FeedbackStyle, View } from "../../lib/variant";
import type { Learner } from "../../domain/learner";

export type PlayableItem =
  | { type: "single"; data: Question }
  | { type: "set"; data: QuestionSet };

export type LearnerProps = {
  answers: Record<string, string>;
  notice: string | null;
  playableItem: PlayableItem;
  questionBankSource: string;
  setAnswer: (id: string, value: string) => void;
  setNotice: (value: string | null) => void;
  feedbackStyle: FeedbackStyle;
  feedbackVisible: boolean;
  feedbackResults: Record<string, "correct" | "incorrect" | "dont-know">;
  view: View;
  setView: (view: View) => void;
  submitAnswer: () => void;
  moveToNextProblem: (message: string) => void;
  onDontKnow: () => void;
  onDispute: () => void;
  learners: Learner[];
  currentLearnerId: string;
  setCurrentLearnerId: (id: string) => void;
  getQuestionTitle: (id: string) => string | undefined;
  todayStats: import("../../domain/learner").TodayLearningStats | null;
};
