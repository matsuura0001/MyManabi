import type { SourceDocument } from "../../domain/sourceDocument";

export function ImportHistory({
  documents,
  openStoredExtraction,
  refresh,
  selectedDocumentId,
}: {
  documents: SourceDocument[];
  openStoredExtraction: (document: SourceDocument) => Promise<void>;
  refresh: () => Promise<void>;
  selectedDocumentId: string | null;
}) {
  const header = (
    <div className="import-history-title">
      <strong>取り込み履歴</strong>
      <button className="text-button" type="button" onClick={refresh}>
        再読み込み
      </button>
    </div>
  );

  if (documents.length === 0) {
    return (
      <section className="import-history">
        {header}
        <p>まだ取り込み済み教材はありません。</p>
      </section>
    );
  }

  return (
    <section className="import-history">
      {header}
      <div className="import-history-list">
        {documents.map((document) => (
          <article
            className={`import-history-item ${selectedDocumentId === document.id ? "selected" : ""}`}
            key={document.id}
          >
            <div>
              <strong>{document.originalFileName}</strong>
              <span>
                {document.kind} / {new Date(document.importedAtEpochSeconds * 1000).toLocaleString()}
              </span>
              <small>{document.id}</small>
            </div>
            <button
              className="small-button"
              type="button"
              onClick={() => openStoredExtraction(document)}
            >
              結果を見る
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
