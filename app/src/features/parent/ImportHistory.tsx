import type { SourceDocument } from "../../domain/sourceDocument";
import { invoke } from "@tauri-apps/api/core";
import { confirm, message } from "@tauri-apps/plugin-dialog";

type DeleteResult = {
  deletedCount: number;
  invalidatedCount: number;
};

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

  const handleDelete = async (documentId: string) => {
    const confirmMessage = "この取り込みを削除します。\n未使用の問題・候補・元ファイルは削除されます。\nすでに学習で使われた問題は、今後出題せず集計から外します。\nこの操作は戻せません。";
    const confirmed = await confirm(confirmMessage, { title: "取り込み履歴の削除", kind: "warning" });
    if (confirmed) {
      try {
        const result: DeleteResult = await invoke("delete_source_document", { sourceDocumentId: documentId });
        await message(`削除が完了しました。\n・未使用の問題: ${result.deletedCount} 問削除\n・出題済みの問題: ${result.invalidatedCount} 問を集計から除外`, { title: "削除完了", kind: "info" });
        await refresh();
      } catch (error) {
        console.error("Failed to delete source document", error);
        await message(`削除に失敗しました: ${error}`, { title: "エラー", kind: "error" });
      }
    }
  };

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
            <div className="button-group">
              <button
                className="small-button"
                type="button"
                onClick={() => openStoredExtraction(document)}
              >
                結果を見る
              </button>
              <button
                className="small-button danger-button"
                type="button"
                onClick={() => handleDelete(document.id)}
              >
                削除する
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
