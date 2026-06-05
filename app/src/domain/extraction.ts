export type RegionRatio = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ExtractionResult = {
  pageCount: number;
  pages: Array<{ page: number; imagePath: string }>;
  candidates: ExtractionCandidate[];
  answerCandidates?: AnswerCandidate[];
  answerLinks?: AnswerLink[];
  metrics: {
    extractionRoute: string;
  };
};

export type ExtractionCandidate = {
  candidateId: string;
  page: number;
  itemLabel?: string;
  region: RegionRatio;
  regionImagePath?: string;
  ocrText: string;
  confidence: number;
  suggestedQuestionType?: string;
  suggestedSubject?: string;
  suggestedUnitId?: string;
  reviewStatus: "draft" | "adult-approved" | "suspended";
};

export type SuggestedAnswer = {
  value: string;
  source: "answer-ocr" | "question-ocr-inference" | "ai-assisted" | "adult-entered";
  confidence: number;
  alternatives?: Array<{
    value: string;
    source: SuggestedAnswer["source"];
    confidence: number;
  }>;
};

export type AnswerCandidate = {
  answerCandidateId: string;
  page: number;
  itemLabel?: string;
  region: RegionRatio;
  regionImagePath?: string;
  ocrText: string;
  confidence: number;
  suggestedAnswer?: SuggestedAnswer;
};

export type AnswerLink = {
  candidateId: string;
  answerCandidateId: string;
  matchReason?: string[];
  confidence: number;
  reviewStatus: "draft" | "adult-approved" | "suspended";
  suggestedAnswer?: SuggestedAnswer;
};

export type PromotionForm = {
  questionId: string;
  subject: string;
  unitId: string;
  skillIds: string;
  questionType: string;
  presentationType: "source-region" | "source-page" | "normalized";
  title: string;
  body: string;
  note: string;
  answerValue: string;
  answerCandidateId?: string;
  purposes: string;
};
