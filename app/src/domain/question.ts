export type QuestionType =
  | "numeric"
  | "kanji"
  | "multiple-choice"
  | "word-problem"
  | "free-text"
  | "handwriting"
  | "speech";

export type RegionRatio = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PresentationType = "text" | "source-region" | "source-page" | "image" | "audio";
export type ExpectedResponseType =
  | "text"
  | "numeric"
  | "choice"
  | "handwriting"
  | "speech"
  | "drawing"
  | "parent-review";
export type AnswerType =
  | "exact-text"
  | "numeric"
  | "choice"
  | "ai-assisted"
  | "source-region"
  | "source-page"
  | "image"
  | "exemplar-image"
  | "audio"
  | "exemplar-audio"
  | "manual-review";
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
  body?: string;
  presentation?: {
    type: PresentationType;
    text?: string;
    documentId?: string;
    page?: number;
    region?: RegionRatio;
    imagePath?: string;
    mediaId?: string;
    transcript?: string;
    showTranscript?: boolean;
  };
  expectedResponse?: {
    type: ExpectedResponseType;
    rubric?: string;
  };
  note: string;
  answer: {
    type: AnswerType;
    value?: string;
    textValue?: string;
    documentId?: string;
    page?: number;
    region?: RegionRatio;
    imagePath?: string;
    mediaId?: string;
    transcript?: string;
    rubric?: string;
    tags?: string[];
  };
  sourceMapping?: {
    questionRegionId?: string;
    answerRegionId?: string;
    relation: "same-item" | "same-page" | "manual-pair" | "answer-key";
    itemLabel?: string;
    confidence?: "adult-confirmed" | "heuristic" | "ai-suggested";
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
