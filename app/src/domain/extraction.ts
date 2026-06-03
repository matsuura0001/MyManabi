export type ExtractionResult = {
  pageCount: number;
  candidates: ExtractionCandidate[];
  metrics: {
    extractionRoute: string;
  };
};

export type ExtractionCandidate = {
  candidateId: string;
  page: number;
  itemLabel?: string;
  ocrText: string;
  confidence: number;
  suggestedQuestionType: string;
  reviewStatus: "draft" | "adult-approved" | "suspended";
};

export type PromotionForm = {
  questionId: string;
  subject: string;
  unitId: string;
  skillIds: string;
  questionType: string;
  title: string;
  body: string;
  note: string;
  answerValue: string;
  purposes: string;
};
