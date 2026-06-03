export type SourceDocumentKind = "pdf" | "image" | "text";
export type SourceDocumentStatus = "stored";
export type SourceDocumentExtractionStatus = "pending-review";

export type SourceDocument = {
  id: string;
  kind: SourceDocumentKind;
  originalFileName: string;
  storedPath: string;
  sourceUrl?: string;
  importedAtEpochSeconds: number;
  byteSize: number;
  status: SourceDocumentStatus;
  extractionStatus: SourceDocumentExtractionStatus;
};
