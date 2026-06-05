import type { AnswerCandidate, AnswerLink } from "./extraction";
import type { Question } from "./question";
import type { QuestionSet } from "./questionSet";

export function normalizeForComparison(line: string): string;
export function subtractCommonLines(questionText: string, answerText: string): string;
export function answerTextFromSuggestion(suggestion: AnswerCandidate["suggestedAnswer"] | undefined): string;
export function bestAnswerSuggestion(
  link: AnswerLink | undefined,
  answer: AnswerCandidate | undefined,
): AnswerCandidate["suggestedAnswer"] | undefined;
export function answerValueFromSelection(
  questionText: string,
  answer: AnswerCandidate | undefined,
  link?: AnswerLink,
): string;
export function expectedAnswerForQuestion(question: Question | undefined): string;
export function questionSetExpectedAnswers(
  questionSet: QuestionSet,
  questions: Question[],
): Array<{ questionId: string; label: string; value: string }>;
export function answerSourceLabel(input: {
  selectedAnswer?: AnswerCandidate;
  answerValue: string;
  requiresAnswerPair: boolean;
}): { kind: "ready" | "missing"; text: string };
