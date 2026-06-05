export type SourceDocumentKind = "pdf" | "image" | "text";
export type SourceDocumentStatus = "stored";
export type SourceDocumentExtractionStatus = "pending-review";

export type SourceDocument = {
  id: string;
  kind: SourceDocumentKind;
  originalFileName: string;
  storedPath: string;
  sourceUrl?: string;
  contentHash?: {
    algorithm: "sha256";
    value: string;
  };
  originalFileNames?: string[];
  firstImportedAtEpochSeconds?: number;
  lastSeenAtEpochSeconds?: number;
  importCount?: number;
  importedAtEpochSeconds: number;
  byteSize: number;
  status: SourceDocumentStatus;
  extractionStatus: SourceDocumentExtractionStatus;
};
