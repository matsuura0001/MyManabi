import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { SourceDocument } from "../../domain/sourceDocument";
import type { ExtractionResult } from "../../domain/extraction";
import type { Question } from "../../domain/question";
import type { QuestionSet } from "../../domain/questionSet";
import type { Variant, View } from "../../lib/variant";
import { Header } from "../../components/Header";
import { SummaryCard } from "../../components/SummaryCard";
import { fallbackProblems } from "../../data/fallbackProblems";
import { ImportHistory } from "./ImportHistory";
import { ExtractionReview } from "./ExtractionReview";
import { QuestionList } from "./QuestionList";
import { RegionPlanSelector } from "./RegionPlanSelector";

interface AiProviderConfig {
  provider: string;
  apiKey: string;
  model: string;
  baseUrl: string;
}

interface AiSettings {
  activeProvider: string;
  providers: AiProviderConfig[];
}


export function ParentConsole({
  variant,
  setView,
  todayStats,
}: {
  variant: Variant;
  setView: (view: View) => void;
  todayStats?: import("../../domain/learner").TodayLearningStats | null;
}) {
  const [suggestion, setSuggestion] = useState("分数のたし算 / 通分を含む問題");
  const [sent, setSent] = useState(false);
  // const [pdfUrl, _setPdfUrl] = useState("");
  const [useAiOcr, setUseAiOcr] = useState(false);
  const [importedDocument, setImportedDocument] = useState<SourceDocument | null>(null);
  const [sourceDocuments, setSourceDocuments] = useState<SourceDocument[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([]);
  const [questionListQuery, setQuestionListQuery] = useState("");
  const [questionListError, setQuestionListError] = useState<string | null>(null);
  const [questionListLoading, setQuestionListLoading] = useState(false);
  const [showImportHistory, setShowImportHistory] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);
  const [extractionPath, setExtractionPath] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const isSidebar = variant === "B";

  const [aiSettings, setAiSettings] = useState<AiSettings | null>(null);
  const [showAiSettingsDialog, setShowAiSettingsDialog] = useState(false);

  useEffect(() => {
    loadSourceDocuments();
    loadQuestionList();
    loadAiSettings();
  }, []);

  useEffect(() => {
    if (!showAiSettingsDialog) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowAiSettingsDialog(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showAiSettingsDialog]);

  async function loadAiSettings() {
    try {
      setAiSettings(await invoke<AiSettings>("get_ai_settings"));
    } catch (caught) {
      console.error("Failed to load AI settings", caught);
    }
  }

  async function handleApiKeyChange(providerName: string, apiKey: string) {
    if (!aiSettings) return;
    const nextProviders = aiSettings.providers.map((p) =>
      p.provider === providerName ? { ...p, apiKey } : p
    );
    const newSettings = { ...aiSettings, providers: nextProviders };
    try {
      await invoke("save_ai_settings", { settings: newSettings });
      setAiSettings(newSettings);
    } catch (caught) {
      setImportError(String(caught));
    }
  }


  async function handleModelChange(providerName: string, model: string) {
    if (!aiSettings) return;
    const nextProviders = aiSettings.providers.map((p) =>
      p.provider === providerName ? { ...p, model } : p
    );
    const newSettings = { ...aiSettings, providers: nextProviders };
    try {
      await invoke("save_ai_settings", { settings: newSettings });
      setAiSettings(newSettings);
    } catch (caught) {
      setImportError(String(caught));
    }
  }

  async function handleBaseUrlChange(providerName: string, baseUrl: string) {
    if (!aiSettings) return;
    const nextProviders = aiSettings.providers.map((p) =>
      p.provider === providerName ? { ...p, baseUrl } : p
    );
    const newSettings = { ...aiSettings, providers: nextProviders };
    try {
      await invoke("save_ai_settings", { settings: newSettings });
      setAiSettings(newSettings);
    } catch (caught) {
      setImportError(String(caught));
    }
  }

  async function handleActiveProviderChange(activeProvider: string) {
    if (!aiSettings) return;
    const newSettings = { ...aiSettings, activeProvider };
    try {
      await invoke("save_ai_settings", { settings: newSettings });
      setAiSettings(newSettings);
    } catch (caught) {
      setImportError(String(caught));
    }
  }

  async function loadSourceDocuments() {
    try {
      setSourceDocuments(await invoke<SourceDocument[]>("list_source_documents"));
    } catch {
      // Browser-only preview does not expose Tauri commands.
    }
  }

  async function loadQuestionList() {
    setQuestionListLoading(true);
    setQuestionListError(null);
    try {
      const [loadedQuestions, loadedSets] = await Promise.all([
        invoke<Question[]>("load_question_bank").catch(() => fallbackProblems),
        invoke<QuestionSet[]>("load_question_sets").catch(() => [] as QuestionSet[]),
      ]);
      setQuestions(loadedQuestions);
      setQuestionSets(loadedSets);
    } catch (caught) {
      setQuestions(fallbackProblems);
      setQuestionSets([]);
      setQuestionListError(`問題一覧を読み込めませんでした。合成問題を表示しています: ${String(caught)}`);
    } finally {
      setQuestionListLoading(false);
    }
  }

  function resetImportState() {
    setImportedDocument(null);
    setExtractionResult(null);
    setExtractionPath(null);
  }

  // async function _importPdf() {
  //   setImporting(true);
  //   setImportError(null);
  //   resetImportState();
  //   try {
  //     const result = await invoke<ExtractionResult>("import_local_pdf", { sourceDocumentId });
  //     setExtractionResult(result);
  //   } catch (error) {
  //     setImportError(String(error));
  //   } finally {
  //     setImporting(false);
  //   }
  // }

  async function selectAndImportSource() {
    const path = await open({
      multiple: false,
      directory: false,
      filters: [
        {
          name: "教材ファイル",
          extensions: ["pdf", "png", "jpg", "jpeg", "webp", "txt", "md"],
        },
      ],
    });
    if (!path) return;

    setImporting(true);
    setImportError(null);
    resetImportState();
    try {
      setImportedDocument(await invoke<SourceDocument>("import_source_from_path", { path }));
      await loadSourceDocuments();
    } catch (caught) {
      setImportError(String(caught));
    } finally {
      setImporting(false);
    }
  }

  async function extractImportedSource() {
    if (!importedDocument) return;

    setExtracting(true);
    setImportError(null);
    setExtractionResult(null);
    setExtractionPath(null);
    try {
      const command = useAiOcr ? "extract_source_document_with_ai" : "extract_source_document";
      const result = await invoke<ExtractionResult>(command, {
        sourceDocumentId: importedDocument.id,
      });
      const path = await invoke<string>("extraction_result_path", {
        sourceDocumentId: importedDocument.id,
      });
      setExtractionResult(result);
      setExtractionPath(path);
      await loadSourceDocuments();
    } catch (caught) {
      setImportError(String(caught));
    } finally {
      setExtracting(false);
    }
  }

  async function rasterizeImportedSource() {
    if (!importedDocument) return;

    setExtracting(true);
    setImportError(null);
    setExtractionResult(null);
    setExtractionPath(null);
    try {
      const result = await invoke<ExtractionResult>("rasterize_source_document", {
        sourceDocumentId: importedDocument.id,
      });
      const path = await invoke<string>("extraction_result_path", {
        sourceDocumentId: importedDocument.id,
      });
      setExtractionResult(result);
      setExtractionPath(path);
      await loadSourceDocuments();
    } catch (caught) {
      setImportError(String(caught));
    } finally {
      setExtracting(false);
    }
  }

  async function openStoredExtraction(document: SourceDocument) {
    setImportError(null);
    setImportedDocument(document);
    setExtracting(false);
    setExtractionResult(null);
    setExtractionPath(null);
    try {
      const result = await invoke<ExtractionResult>("load_extraction_result", {
        sourceDocumentId: document.id,
      });
      const path = await invoke<string>("extraction_result_path", {
        sourceDocumentId: document.id,
      });
      setExtractionResult(result);
      setExtractionPath(path);
    } catch (caught) {
      setImportError(`保存済みの抽出結果を開けませんでした: ${String(caught)}`);
    }
  }

  return (
    <main className={`app-shell parent-shell ${isSidebar ? "with-sidebar" : ""}`}>
      <Header view="parent" setView={setView} />
      {isSidebar && (
        <aside className="parent-sidebar">
          <strong>おうちの人</strong>
          <a className="selected">今日の様子</a>
          <a href="#parent-question-list">確認問題</a>
          <a>学習パターン</a>
          <a>公開用レポート</a>
        </aside>
      )}
      <section className="parent-main">
        <div className="parent-title">
          <div>
            <p className="eyebrow">あおい / 今日の学習</p>
            <h1>話してみる候補が 2 件あります</h1>
          </div>
          <span className="date-chip">2026-06-02</span>
        </div>

        <div className="summary-row">
          <SummaryCard label="取り組んだ問題" value={todayStats ? todayStats.attempted.toString() : "0"} unit="問" />
          <SummaryCard label="正答" value={todayStats ? todayStats.correct.toString() : "0"} unit="問" />
          <SummaryCard label="分からない" value={todayStats ? todayStats.unknown.toString() : "0"} unit="件" accent={!!todayStats && todayStats.unknown > 0} />
          <SummaryCard label="納得できない" value={todayStats ? todayStats.disputed.toString() : "0"} unit="件" accent={!!todayStats && todayStats.disputed > 0} />
        </div>

        <div className="parent-grid">
          <section className="parent-card attention-card">
            <p className="eyebrow">今日、話してみる候補</p>
            <h2>分数のたし算</h2>
            <ul>
              <li>通分を含む問題で「分からない」が 1 件ありました。</li>
              <li>AI の判定へ「納得できない」が 1 件ありました。</li>
            </ul>
            <button className="small-button" type="button">
              確認結果を記録する
            </button>
          </section>

          <section className="parent-card suggestion-card">
            <p className="eyebrow">確認問題を提案する</p>
            <h2>次に解いてほしい問題</h2>
            <select
              value={suggestion}
              onChange={(event) => setSuggestion(event.currentTarget.value)}
            >
              <option>分数のたし算 / 通分を含む問題</option>
              <option>分数のたし算 / 同分母の問題</option>
              <option>前回「分からない」だった問題</option>
            </select>
            <button className="small-button" type="button" onClick={() => setSent(true)}>
              1 問だけ提案する
            </button>
            {sent && <small>次の学習時に表示します。</small>}
          </section>
        </div>

        <section className="parent-card pattern-card">
          <div>
            <p className="eyebrow">現在の学習パターン</p>
            <h2>教科書順 + 復習を少し混ぜる</h2>
            <p>基準線と比較できるよう、選定理由と結果を記録しています。</p>
          </div>
          <button className="outline-button" type="button">
            パターンを確認
          </button>
        </section>

        <QuestionList
          error={questionListError}
          loading={questionListLoading}
          query={questionListQuery}
          questionSets={questionSets}
          questions={questions}
          refresh={loadQuestionList}
          setQuery={setQuestionListQuery}
        />

        <section className="parent-card report-card">
          <p className="eyebrow">公開用統計</p>
          <h2>個別回答を含まない集計レポート</h2>
          <p>
            分野、学習パターン、評価条件、正答率などを確認してから、任意で共有できます。
          </p>
          <button className="outline-button" type="button">
            プレビュー
          </button>
        </section>

        <section className="parent-card import-card">
          <p className="eyebrow">教材を取り込む</p>
          <h2>教材ファイルを登録</h2>
          <p>
            PDF、画像、テキストを端末内の DATA_DIR に保存します。PDF と画像は先にページ画像を確認し、矩形を指定してから OCR できます。
          </p>
          <button
            className="small-button"
            disabled={importing || extracting}
            type="button"
            onClick={selectAndImportSource}
          >
            {importing ? "登録中..." : "ファイルを選択"}
          </button>
          <button
            className="secondary-button import-history-toggle"
            type="button"
            onClick={() => setShowImportHistory((value) => !value)}
          >
            {showImportHistory ? "取り込み履歴を閉じる" : "取り込み履歴 / 結果を見る"}
          </button>
          {showImportHistory && (
            <ImportHistory
              documents={sourceDocuments}
              openStoredExtraction={openStoredExtraction}
              refresh={loadSourceDocuments}
              selectedDocumentId={importedDocument?.id ?? null}
            />
          )}

          {aiSettings && (
            <button
              className="secondary-button ai-settings-button"
              type="button"
              onClick={() => setShowAiSettingsDialog(true)}
            >
              AI-OCR 設定
            </button>
          )}

          {importedDocument && (
            <div className="import-success">
              <p>
                {importedDocument.originalFileName} を保存しました。種類: {importedDocument.kind}
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', margin: '0.5rem 0' }}>
                <button
                  className="small-button"
                  disabled={extracting}
                  type="button"
                  onClick={rasterizeImportedSource}
                >
                  {extracting ? "処理中..." : "ページ画像を表示"}
                </button>
                <button
                  className="secondary-button"
                  disabled={extracting}
                  type="button"
                  onClick={extractImportedSource}
                >
                  {extracting ? "候補を抽出中..." : "自動 OCR で候補を抽出"}
                </button>
                <label style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }}>
                  <input type="checkbox" checked={useAiOcr} onChange={e => setUseAiOcr(e.target.checked)} />
                  複雑なレイアウト向け AI-OCR を優先
                </label>
              </div>
            </div>
          )}
          {importedDocument && extractionResult && extractionResult.pages.length > 0 && (
            <RegionPlanSelector
              extractionPath={extractionPath}
              result={extractionResult}
              setImportError={setImportError}
              sourceDocumentId={importedDocument.id}
              onUpdated={setExtractionResult}
            />
          )}
          {importedDocument && extractionResult && (
            <ExtractionReview
              key={`${importedDocument.id}-${extractionResult.candidates.length}`}
              extractionPath={extractionPath}
              initialResult={extractionResult}
              setImportError={setImportError}
              sourceDocumentId={importedDocument.id}
            />
          )}
          {importError && <p className="import-error">取り込めませんでした: {importError}</p>}
        </section>
      </section>

      {aiSettings && showAiSettingsDialog && (
        <div className="settings-dialog-backdrop" role="presentation" onClick={() => setShowAiSettingsDialog(false)}>
          <section
            aria-labelledby="ai-settings-title"
            aria-modal="true"
            className="settings-dialog"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="settings-dialog-header">
              <div>
                <p className="eyebrow">教材を取り込む</p>
                <h2 id="ai-settings-title">AI-OCR 設定</h2>
              </div>
              <button
                aria-label="AI-OCR 設定を閉じる"
                className="region-modal-close"
                type="button"
                onClick={() => setShowAiSettingsDialog(false)}
              >
                ×
              </button>
            </header>

            <div className="settings-dialog-body">
              <label className="settings-provider-select">
                <span>使用するプロバイダ</span>
                <select
                  value={aiSettings.activeProvider}
                  onChange={(event) => handleActiveProviderChange(event.currentTarget.value)}
                >
                  {aiSettings.providers.map((provider) => (
                    <option key={provider.provider} value={provider.provider}>
                      {provider.provider}
                    </option>
                  ))}
                </select>
              </label>

              <div className="ai-provider-list">
                {aiSettings.providers.map((provider) => (
                  <section
                    className={`ai-provider-panel ${aiSettings.activeProvider === provider.provider ? "active" : ""}`}
                    key={provider.provider}
                  >
                    <strong>{provider.provider}</strong>
                    <label>
                      <span>API Key</span>
                      <input
                        type="password"
                        placeholder={`${provider.provider} の API Key`}
                        value={provider.apiKey}
                        onChange={(event) => handleApiKeyChange(provider.provider, event.currentTarget.value)}
                      />
                    </label>
                    <label>
                      <span>モデル名</span>
                      <input
                        type="text"
                        placeholder="例: gemini-1.5-flash"
                        value={provider.model}
                        onChange={(event) => handleModelChange(provider.provider, event.currentTarget.value)}
                      />
                    </label>
                    <label>
                      <span>Base URL</span>
                      <input
                        type="url"
                        placeholder="API のベース URL"
                        value={provider.baseUrl}
                        onChange={(event) => handleBaseUrlChange(provider.provider, event.currentTarget.value)}
                      />
                    </label>
                  </section>
                ))}
              </div>
            </div>

            <footer className="settings-dialog-footer">
              <button className="secondary-button" type="button" onClick={() => setShowAiSettingsDialog(false)}>
                閉じる
              </button>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}
