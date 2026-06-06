export type QuestionSetMaterialType = "text" | "source-region" | "source-page" | "image" | "audio";

export type QuestionSetMaterial = {
  type: QuestionSetMaterialType;
  text?: string;
  documentId?: string;
  page?: number;
  region?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  imagePath?: string;
  mediaId?: string;
};

export type QuestionSetItem = {
  questionId: string;
  label?: string;
  order: number;
  regionHint?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

export type QuestionSet = {
  id: string;
  source: {
    type: "adult-authored" | "ai-generated" | "local-generated" | "imported";
    templateId?: string;
    documentId?: string;
    page?: number;
    itemLabel?: string;
  };
  questionMaterials: QuestionSetMaterial[];
  answerMaterials: QuestionSetMaterial[];
  items: QuestionSetItem[];
};
