export type QuestionType =
  | "numeric"
  | "kanji"
  | "multiple-choice"
  | "word-problem"
  | "free-text"
  | "handwriting"
  | "speech";

export type AnswerType = "exact-text" | "numeric" | "choice" | "ai-assisted";
export type QuestionSourceType = "adult-authored" | "ai-generated" | "local-generated" | "imported";
export type QuestionReviewStatus = "draft" | "adult-approved" | "auto-approved" | "suspended";
export type QuestionPurpose = "learning" | "review" | "assessment";

export type SpikeOutcome = {
  accountEmail: string | null;
  planType: string | null;
  model: string | null;
  problemText: string;
};

export type Question = {
  id: string;
  subject: string;
  unitId: string;
  skillIds: string[];
  questionType: QuestionType;
  title: string;
  body: string;
  note: string;
  answer: {
    type: AnswerType;
    value: string;
  };
  source: {
    type: QuestionSourceType;
    templateId?: string;
    documentId?: string;
    page?: number;
    itemLabel?: string;
  };
  reviewStatus: QuestionReviewStatus;
  purposes: QuestionPurpose[];
};
