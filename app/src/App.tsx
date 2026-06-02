import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

// PROTOTYPE: two screen-design variants, switchable via ?variant=A|B.
type SpikeOutcome = {
  accountEmail: string | null;
  planType: string | null;
  model: string | null;
  problemText: string;
};

type SourceDocument = {
  id: string;
  kind: string;
  originalFileName: string;
  storedPath: string;
  sourceUrl?: string;
  importedAtEpochSeconds: number;
  byteSize: number;
  status: string;
  extractionStatus: string;
};

type View = "learner" | "parent";
type Variant = "A" | "B";
type FeedbackStyle = "inline" | "banner" | "sheet";
type Question = {
  id: string;
  subject: string;
  unitId: string;
  skillIds: string[];
  questionType: string;
  title: string;
  body: string;
  note: string;
  answer: {
    type: string;
    value: string;
  };
  source: {
    type: string;
    templateId?: string;
    documentId?: string;
    page?: number;
    itemLabel?: string;
  };
  reviewStatus: string;
  purposes: string[];
};

const VARIANTS: { id: Variant; name: string }[] = [
  { id: "A", name: "問題ファースト" },
  { id: "B", name: "親子ホーム" },
];

const fallbackProblems: Question[] = [
  {
    id: "prototype-fraction-story-01",
    subject: "算数",
    unitId: "fraction-addition",
    skillIds: ["same-denominator-addition"],
    questionType: "word-problem",
    title: "文章を読んで、式と答えを書いてみよう",
    body: "ジュースが 3/8 L あります。そこへ 2/8 L を足しました。ジュースは全部で何 L になりましたか。",
    note: "前に学んだ「同分母のたし算」の確認です",
    answer: { type: "exact-text", value: "5/8 L" },
    source: { type: "adult-authored" },
    reviewStatus: "adult-approved",
    purposes: ["learning", "review"],
  },
  {
    id: "prototype-fraction-basic-01",
    subject: "算数",
    unitId: "fraction-addition",
    skillIds: ["same-denominator-addition"],
    questionType: "numeric",
    title: "図を見ながら考えてみよう",
    body: "3/8 + 2/8 = ?",
    note: "あとで解くこともできます",
    answer: { type: "exact-text", value: "5/8" },
    source: { type: "adult-authored" },
    reviewStatus: "adult-approved",
    purposes: ["learning", "review"],
  },
];

const DEFAULT_PROMPT =
  "小学3年生向けの足し算の問題を1問だけ、答え付きで作ってください。";

function readVariant(): Variant {
  const value = new URLSearchParams(window.location.search).get("variant");
  return value === "B" ? "B" : "A";
}

function setVariantInUrl(variant: Variant) {
  const params = new URLSearchParams(window.location.search);
  params.set("variant", variant);
  window.history.replaceState({}, "", `${window.location.pathname}?${params}`);
}

function App() {
  const [variant, setVariant] = useState<Variant>(readVariant);
  const [view, setView] = useState<View>("learner");
  const [problemIndex, setProblemIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [feedbackStyle, setFeedbackStyle] = useState<FeedbackStyle>("inline");
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [showDeveloperPanel, setShowDeveloperPanel] = useState(false);
  const [problems, setProblems] = useState<Question[]>(fallbackProblems);
  const [questionBankSource, setQuestionBankSource] = useState("ブラウザ用の合成問題");

  const currentProblem = problems[problemIndex % problems.length];

  useEffect(() => {
    invoke<Question[]>("load_question_bank_for_notes", {
      noteIds: ["fraction-addition"],
    })
      .then((loadedProblems) => {
        if (loadedProblems.length > 0) {
          setProblems(loadedProblems);
          setQuestionBankSource("Obsidian 索引: fraction-addition");
        }
      })
      .catch(() =>
        invoke<Question[]>("load_question_bank")
          .then((loadedProblems) => {
            if (loadedProblems.length > 0) {
              setProblems(loadedProblems);
              setQuestionBankSource("DATA_DIR の確認済み問題");
            }
          })
          .catch(() => {
            // Browser-only preview does not expose Tauri commands.
          }),
      );
  }, []);

  function selectVariant(next: Variant) {
    setVariant(next);
    setVariantInUrl(next);
  }

  function cycleVariant(direction: number) {
    const index = VARIANTS.findIndex((item) => item.id === variant);
    const next = VARIANTS[(index + direction + VARIANTS.length) % VARIANTS.length];
    selectVariant(next.id);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target?.matches("input, textarea, [contenteditable='true']") ||
        !["ArrowLeft", "ArrowRight"].includes(event.key)
      ) {
        return;
      }
      cycleVariant(event.key === "ArrowRight" ? 1 : -1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function moveToNextProblem(message: string) {
    setNotice(message);
    setAnswer("");
    setFeedbackVisible(false);
    setProblemIndex((value) => value + 1);
  }

  function submitAnswer() {
    setNotice(null);
    setFeedbackVisible(true);
  }

  return (
    <>
      {variant === "A" ? (
        <VariantA
          answer={answer}
          notice={notice}
          problem={currentProblem}
          questionBankSource={questionBankSource}
          setAnswer={setAnswer}
          setNotice={setNotice}
          feedbackStyle={feedbackStyle}
          feedbackVisible={feedbackVisible}
          setFeedbackStyle={setFeedbackStyle}
          view={view}
          setView={setView}
          submitAnswer={submitAnswer}
          moveToNextProblem={moveToNextProblem}
        />
      ) : (
        <VariantB
          answer={answer}
          notice={notice}
          problem={currentProblem}
          questionBankSource={questionBankSource}
          setAnswer={setAnswer}
          setNotice={setNotice}
          feedbackStyle={feedbackStyle}
          feedbackVisible={feedbackVisible}
          setFeedbackStyle={setFeedbackStyle}
          view={view}
          setView={setView}
          submitAnswer={submitAnswer}
          moveToNextProblem={moveToNextProblem}
        />
      )}

      <button
        className="developer-toggle"
        type="button"
        onClick={() => setShowDeveloperPanel((value) => !value)}
      >
        {showDeveloperPanel ? "開発パネルを閉じる" : "開発パネル"}
      </button>
      {showDeveloperPanel && <DeveloperSpike />}

      {import.meta.env.DEV && (
        <PrototypeSwitcher
          variant={variant}
          cycleVariant={cycleVariant}
          selectVariant={selectVariant}
        />
      )}
    </>
  );
}

type VariantProps = {
  answer: string;
  notice: string | null;
  problem: Question;
  questionBankSource: string;
  setAnswer: (value: string) => void;
  setNotice: (value: string | null) => void;
  feedbackStyle: FeedbackStyle;
  feedbackVisible: boolean;
  setFeedbackStyle: (style: FeedbackStyle) => void;
  view: View;
  setView: (view: View) => void;
  submitAnswer: () => void;
  moveToNextProblem: (message: string) => void;
};

function VariantA(props: VariantProps) {
  if (props.view === "parent") {
    return <ParentConsole variant="A" setView={props.setView} />;
  }

  return (
    <main className="app-shell focus-shell">
      <Header view={props.view} setView={props.setView} />
      <section className="focus-stage">
        <div className="learner-strip">
          <span className="avatar">あ</span>
          <div>
            <strong>あおい / 3 もんめ</strong>
          </div>
          <span className="soft-chip">あと 2 もん</span>
        </div>

        {props.notice && <p className="notice">{props.notice}</p>}
        <FeedbackBanner
          style={props.feedbackStyle}
          visible={props.feedbackVisible}
          moveToNextProblem={props.moveToNextProblem}
          setNotice={props.setNotice}
          expectedAnswer={props.problem.answer.value}
        />

        <article className="problem-sheet wide-sheet">
          <div className="problem-copy">
            <p className="eyebrow">
              {props.problem.subject} / {props.problem.skillIds.join(" / ")}
            </p>
            <h1>{props.problem.title}</h1>
            <p className="problem-body story-problem">{props.problem.body}</p>
            <p className="problem-note">{props.problem.note}</p>
          </div>

          {props.feedbackVisible && props.feedbackStyle === "sheet" && (
            <aside className="feedback-sheet">
              <div className="feedback-check">✓</div>
              <div>
                <p className="eyebrow">回答を記録しました</p>
                <h2>正解です</h2>
                <p>{props.problem.answer.value}</p>
              </div>
              <div className="feedback-sheet-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => props.setNotice("答えがちがうと思う、と記録しました。")}
                >
                  答えがちがうと思う
                </button>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => props.moveToNextProblem("次の問題を表示しました。")}
                >
                  次の問題
                </button>
              </div>
            </aside>
          )}

          <div className="answer-row">
            <label className="answer-box">
              <span>式とこたえ</span>
              <input
                autoFocus
                value={props.answer}
                onChange={(event) => props.setAnswer(event.currentTarget.value)}
                placeholder="ここに入力"
              />
            </label>
            <div className="answer-actions">
              <button
                className="primary-button answer-submit"
                type="button"
                onClick={
                  props.feedbackVisible && props.feedbackStyle === "inline"
                    ? () => props.moveToNextProblem("次の問題を表示しました。")
                    : props.submitAnswer
                }
              >
                {props.feedbackVisible && props.feedbackStyle === "inline" ? "次の問題" : "こたえる"}
              </button>
              <button
                className="ghost-button answer-submit"
                type="button"
                onClick={() => props.setNotice("解説を表示する画面へ進みます。")}
              >
                分からない
              </button>
            </div>
          </div>

          {props.feedbackVisible && props.feedbackStyle === "inline" && (
            <div className="inline-feedback">
              <div>
                <strong>正解です</strong>
                <span>{props.problem.answer.value}</span>
              </div>
              <button
                className="secondary-button"
                type="button"
                onClick={() => props.setNotice("答えがちがうと思う、と記録しました。")}
              >
                答えがちがうと思う
              </button>
            </div>
          )}

          <div className="secondary-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={() => props.setNotice("今日はここまで。3 問取り組みました。")}
            >
              今日はここまで
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => props.setNotice("大人と確認する項目へ追加しました。")}
            >
              大人と確認する
            </button>
          </div>
        </article>
        <small className="question-bank-source">出題元: {props.questionBankSource}</small>
        <FeedbackStylePicker style={props.feedbackStyle} setStyle={props.setFeedbackStyle} />
      </section>
    </main>
  );
}

function VariantB(props: VariantProps) {
  if (props.view === "parent") {
    return <ParentConsole variant="B" setView={props.setView} />;
  }

  return (
    <main className="app-shell home-shell">
      <Header view={props.view} setView={props.setView} />
      <section className="home-grid">
        <article className="welcome-panel">
          <p className="eyebrow">こんにちは、あおい</p>
          <h1>分数のたし算</h1>
          <p>前回の続き / 7 問まで完了</p>
          <button
            className="primary-button large"
            type="button"
            onClick={() => props.setNotice("前回の続きから始めます。")}
          >
            前回のつづき
          </button>
        </article>

        <article className="message-panel">
          <p className="eyebrow">おうちの人から</p>
          <p className="message-copy">分数の問題を 1 問だけ確認してみたいです。</p>
          <div className="inline-actions">
            <button
              className="small-button"
              type="button"
              onClick={() => props.setNotice("確認問題を最初に表示します。")}
            >
              やってみる
            </button>
            <button
              className="link-button"
              type="button"
              onClick={() => props.setNotice("あとで確認できるようにしました。")}
            >
              あとで
            </button>
            <button
              className="link-button"
              type="button"
              onClick={() => props.setNotice("今は解きたくないと伝えました。")}
            >
              今はやらない
            </button>
          </div>
        </article>

        {props.notice && <p className="notice wide">{props.notice}</p>}

        <article className="split-problem">
          <div className="split-question">
            <p className="eyebrow">
              {props.problem.subject} / {props.problem.skillIds.join(" / ")}
            </p>
            <h2>{props.problem.title}</h2>
            <p className="story-problem">{props.problem.body}</p>
            <p className="problem-note">{props.problem.note}</p>
          </div>
          <aside className="split-controls">
            <label className="answer-box horizontal">
              <span>式とこたえ</span>
              <input
                value={props.answer}
                onChange={(event) => props.setAnswer(event.currentTarget.value)}
                placeholder="入力"
              />
            </label>
            <button
              className="primary-button"
              type="button"
              onClick={props.submitAnswer}
            >
              こたえる
            </button>
            {props.feedbackVisible && (
              <div className="compact-feedback">
                <strong>正解です</strong>
                <span>{props.problem.answer.value}</span>
                <button
                  className="small-button"
                  type="button"
                  onClick={() => props.moveToNextProblem("次の問題を表示しました。")}
                >
                  次の問題
                </button>
              </div>
            )}
            <button
              className="ghost-button"
              type="button"
              onClick={() => props.setNotice("解説を表示する画面へ進みます。")}
            >
              分からない
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => props.setNotice("今日はここまで。取り組んだ内容を記録しました。")}
            >
              今日はここまで
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => props.setNotice("大人と確認する項目へ追加しました。")}
            >
              大人と確認する
            </button>
          </aside>
        </article>
      </section>
    </main>
  );
}

function FeedbackStylePicker({
  setStyle,
  style,
}: {
  setStyle: (style: FeedbackStyle) => void;
  style: FeedbackStyle;
}) {
  return (
    <aside className="feedback-style-picker">
      <span>正解表示の比較:</span>
      {(["inline", "banner", "sheet"] as const).map((item) => (
        <button
          className={style === item ? "active" : ""}
          key={item}
          type="button"
          onClick={() => setStyle(item)}
        >
          {item === "inline" ? "カード内" : item === "banner" ? "上部通知" : "次へ確認"}
        </button>
      ))}
    </aside>
  );
}

function FeedbackBanner({
  expectedAnswer,
  moveToNextProblem,
  setNotice,
  style,
  visible,
}: {
  expectedAnswer: string;
  moveToNextProblem: (message: string) => void;
  setNotice: (value: string | null) => void;
  style: FeedbackStyle;
  visible: boolean;
}) {
  if (!visible || style !== "banner") return null;
  return (
    <aside className="feedback-banner">
      <div>
        <strong>正解です</strong>
        <span>{expectedAnswer}</span>
      </div>
      <button type="button" onClick={() => setNotice("答えがちがうと思う、と記録しました。")}>
        答えがちがうと思う
      </button>
      <button type="button" onClick={() => moveToNextProblem("次の問題を表示しました。")}>
        次の問題
      </button>
    </aside>
  );
}

function Header({
  view,
  setView,
}: {
  view: View;
  setView: (view: View) => void;
}) {
  return (
    <header className="app-header">
      <nav className="view-switch" aria-label="画面切り替え">
        <button
          className={view === "learner" ? "active" : ""}
          type="button"
          onClick={() => setView("learner")}
        >
          学習する
        </button>
        <button
          className={view === "parent" ? "active" : ""}
          type="button"
          onClick={() => setView("parent")}
        >
          おうちの人
        </button>
      </nav>
    </header>
  );
}

function ParentConsole({ variant, setView }: { variant: Variant; setView: (view: View) => void }) {
  const [suggestion, setSuggestion] = useState("分数のたし算 / 通分を含む問題");
  const [sent, setSent] = useState(false);
  const [pdfUrl, setPdfUrl] = useState("");
  const [importedDocument, setImportedDocument] = useState<SourceDocument | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const isSidebar = variant === "B";

  async function importPdf() {
    setImporting(true);
    setImportError(null);
    setImportedDocument(null);
    try {
      setImportedDocument(await invoke<SourceDocument>("import_pdf_from_url", { url: pdfUrl }));
    } catch (caught) {
      setImportError(String(caught));
    } finally {
      setImporting(false);
    }
  }

  return (
    <main className={`app-shell parent-shell ${isSidebar ? "with-sidebar" : ""}`}>
      <Header view="parent" setView={setView} />
      {isSidebar && (
        <aside className="parent-sidebar">
          <strong>おうちの人</strong>
          <a className="selected">今日の様子</a>
          <a>確認問題</a>
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
          <SummaryCard label="取り組んだ問題" value="7" unit="問" />
          <SummaryCard label="正答" value="5" unit="問" />
          <SummaryCard label="分からない" value="1" unit="件" accent />
          <SummaryCard label="納得できない" value="1" unit="件" accent />
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
            <select value={suggestion} onChange={(event) => setSuggestion(event.currentTarget.value)}>
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
          <h2>PDF プリントを登録</h2>
          <p>
            PDF は端末内の DATA_DIR に保存します。登録後に内容を確認し、問題候補を作成します。
          </p>
          <div className="import-row">
            <input
              aria-label="PDF の URL"
              placeholder="https://.../worksheet.pdf"
              type="url"
              value={pdfUrl}
              onChange={(event) => setPdfUrl(event.currentTarget.value)}
            />
            <button
              className="small-button"
              disabled={importing || pdfUrl.trim() === ""}
              type="button"
              onClick={importPdf}
            >
              {importing ? "取り込み中..." : "PDF を取り込む"}
            </button>
          </div>
          {importedDocument && (
            <p className="import-success">
              {importedDocument.originalFileName} を保存しました。状態: 抽出・確認待ち
            </p>
          )}
          {importError && <p className="import-error">取り込めませんでした: {importError}</p>}
        </section>
      </section>
    </main>
  );
}

function SummaryCard({
  accent = false,
  label,
  unit,
  value,
}: {
  accent?: boolean;
  label: string;
  unit: string;
  value: string;
}) {
  return (
    <article className={`summary-card ${accent ? "accent" : ""}`}>
      <span>{label}</span>
      <strong>
        {value}
        <small>{unit}</small>
      </strong>
    </article>
  );
}

function PrototypeSwitcher({
  cycleVariant,
  selectVariant,
  variant,
}: {
  cycleVariant: (direction: number) => void;
  selectVariant: (variant: Variant) => void;
  variant: Variant;
}) {
  const current = useMemo(() => VARIANTS.find((item) => item.id === variant)!, [variant]);
  return (
    <aside className="prototype-switcher">
      <button type="button" onClick={() => cycleVariant(-1)} aria-label="前の案">
        ←
      </button>
      <select value={variant} onChange={(event) => selectVariant(event.currentTarget.value as Variant)}>
        {VARIANTS.map((item) => (
          <option key={item.id} value={item.id}>
            {item.id} — {item.name}
          </option>
        ))}
      </select>
      <button type="button" onClick={() => cycleVariant(1)} aria-label="次の案">
        →
      </button>
      <span>PROTOTYPE</span>
      <em>{current.name}</em>
    </aside>
  );
}

function DeveloperSpike() {
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [outcome, setOutcome] = useState<SpikeOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function runSpike() {
    setLoading(true);
    setError(null);
    setOutcome(null);
    try {
      setOutcome(await invoke<SpikeOutcome>("codex_spike", { prompt }));
    } catch (caught) {
      setError(String(caught));
    } finally {
      setLoading(false);
    }
  }

  return (
    <aside className="developer-panel">
      <strong>codex app-server 疎通スパイク</strong>
      <textarea value={prompt} onChange={(event) => setPrompt(event.currentTarget.value)} rows={3} />
      <button type="button" onClick={runSpike} disabled={loading}>
        {loading ? "生成中..." : "問題を 1 問つくる"}
      </button>
      {error && <pre className="error">エラー: {error}</pre>}
      {outcome && (
        <pre className="spike-result">
          {outcome.accountEmail ?? "(不明)"} / {outcome.planType ?? "(不明)"} /{" "}
          {outcome.model ?? "(既定モデル)"}
          {"\n\n"}
          {outcome.problemText}
        </pre>
      )}
    </aside>
  );
}

export default App;
