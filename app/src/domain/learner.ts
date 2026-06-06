export type Learner = {
  id: string;
  name: string;
  iconUrl?: string;
};

export type QuestionQueueItem = {
  learnerId: string;
  questionId: string;
  prioritySnapshot: unknown;
  calculatedAt: string;
  expiresAt: string;
};

export type EventResponse = {
  type: "text" | "choice" | "handwriting-image" | "audio" | "none";
  text?: string;
  choice_id?: string;
  media_id?: string;
  reason?: string;
};

export type EventGrading = {
  result: "correct" | "incorrect" | "unknown";
  method: "deterministic" | "ai" | "adult" | "not-graded";
  reason: string;
};

export type EventFlags = {
  did_not_know: boolean;
  disputed: boolean;
  anxious: boolean;
};

export type LearningEvent = {
  schema_version: number;
  event_id: string;
  occurred_at: string;
  learner_id: string;
  unit: string;
  template_id: string;
  question: string;
  response: EventResponse;
  grading: EventGrading;
  duration_seconds: number;
  flags: EventFlags;
  explanations: string[];
  adult_review_required: boolean;
};

export type TodayLearningStats = {
  attempted: number;
  correct: number;
  incorrect: number;
  unknown: number;
  disputed: number;
};
