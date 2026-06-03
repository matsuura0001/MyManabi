import type { Question } from "../../domain/question";
import type { FeedbackStyle, View } from "../../lib/variant";

export type LearnerProps = {
  answer: string;
  notice: string | null;
  problem: Question;
  questionBankSource: string;
  setAnswer: (value: string) => void;
  setNotice: (value: string | null) => void;
  feedbackStyle: FeedbackStyle;
  feedbackVisible: boolean;
  setFeedbackStyle: (style: FeedbackStyle) => void;
  view: View;
  setView: (view: View) => void;
  submitAnswer: () => void;
  moveToNextProblem: (message: string) => void;
};
