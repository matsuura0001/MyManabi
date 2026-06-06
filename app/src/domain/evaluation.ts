export interface ProposedItem {
  label: string;
  value: string;
  confidence: number;
}

export interface SplitOutcome {
  items: ProposedItem[];
  unassignedText: string;
}

export interface RuleSplitCandidate {
  ruleId: string;
  ruleName: string;
  ruleDescription: string;
  /** "builtin" | "custom" | "ai-generated" */
  source: string;
  items: ProposedItem[];
  unassignedText: string;
}

export interface LocalSplitOutcome {
  candidates: RuleSplitCandidate[];
}

export interface AnswerSplitEvaluationCase {
  id: string;
  sourceDocumentId?: string;
  questionSetId?: string;
  inputText: string;
  expectedItemCount: number;
  ruleOutput: ProposedItem[];
  aiOutput: ProposedItem[];
  finalItems: ProposedItem[];
  status: "accepted" | "corrected" | "failed";
}
