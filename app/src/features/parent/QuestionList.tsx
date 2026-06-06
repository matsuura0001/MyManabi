import type { Question } from "../../domain/question";
import type { QuestionSet } from "../../domain/questionSet";

type QuestionListProps = {
  loading: boolean;
  questions: Question[];
  questionSets: QuestionSet[];
  query: string;
  setQuery: (query: string) => void;
  error: string | null;
  refresh: () => Promise<void>;
};

function sourceLabel(sourceType: Question["source"]["type"]) {
  switch (sourceType) {
    case "adult-authored":
      return "手作成";
    case "ai-generated":
      return "AI生成";
    case "local-generated":
      return "端末生成";
    case "imported":
      return "取り込み";
  }
}

function statusLabel(status: Question["reviewStatus"]) {
  switch (status) {
    case "adult-approved":
      return "承認済み";
    case "auto-approved":
      return "自動承認";
    case "draft":
      return "下書き";
    case "suspended":
      return "停止中";
  }
}

function questionPreview(question: Question) {
  if (question.body?.trim()) return question.body;
  if (question.presentation?.text?.trim()) return question.presentation.text;
  if (question.presentation?.type === "source-region") return "教材画像の指定範囲を表示します。";
  if (question.presentation?.type === "source-page") return "教材ページ画像を表示します。";
  if (question.presentation?.type === "image") return "画像問題です。";
  if (question.presentation?.type === "audio") return "音声問題です。";
  return "表示内容は教材データを参照します。";
}

function setTitle(set: QuestionSet, questionsById: Map<string, Question>) {
  const firstQuestion = set.items
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((item) => questionsById.get(item.questionId))
    .find(Boolean);

  return firstQuestion ? `${firstQuestion.title} ほか` : set.id;
}

export function QuestionList({
  loading,
  questions,
  questionSets,
  query,
  setQuery,
  error,
  refresh,
}: QuestionListProps) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const questionsById = new Map(questions.map((question) => [question.id, question]));
  const filteredQuestions = questions.filter((question) => {
    if (!normalizedQuery) return true;
    return [
      question.title,
      question.body ?? "",
      question.subject,
      question.unitId,
      question.questionType,
      question.reviewStatus,
      question.source.type,
      question.id,
    ]
      .join(" ")
      .toLocaleLowerCase()
      .includes(normalizedQuery);
  });
  const filteredSets = questionSets.filter((set) => {
    if (!normalizedQuery) return true;
    const childText = set.items
      .map((item) => questionsById.get(item.questionId))
      .filter(Boolean)
      .map((question) => `${question?.title} ${question?.body ?? ""}`)
      .join(" ");
    return `${set.id} ${set.source.type} ${childText}`.toLocaleLowerCase().includes(normalizedQuery);
  });

  return (
    <section className="parent-card question-list-card" id="parent-question-list">
      <div className="question-list-header">
        <div>
          <p className="eyebrow">問題一覧</p>
          <h2>登録済みの問題を確認</h2>
        </div>
        <button className="text-button" type="button" onClick={refresh}>
          再読み込み
        </button>
      </div>

      <div className="question-list-tools">
        <label>
          <span>検索</span>
          <input
            type="search"
            placeholder="タイトル、単元、本文で探す"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
        </label>
        <div className="question-list-counts" aria-live="polite">
          <strong>{questions.length}</strong>
          <span>単問</span>
          <strong>{questionSets.length}</strong>
          <span>セット</span>
        </div>
      </div>

      {error && <p className="question-list-error">{error}</p>}
      {loading && <p className="question-list-empty">問題を読み込んでいます。</p>}

      {!loading && !error && filteredQuestions.length === 0 && filteredSets.length === 0 && (
        <p className="question-list-empty">条件に合う問題はありません。</p>
      )}

      {!loading && filteredSets.length > 0 && (
        <div className="question-list-section">
          <strong>問題セット</strong>
          <div className="question-list">
            {filteredSets.map((set) => (
              <article className="question-list-item set-item" key={set.id}>
                <div>
                  <h3>{setTitle(set, questionsById)}</h3>
                  <p>
                    {set.items.length} 問 / {sourceLabel(set.source.type)}
                  </p>
                  <small>{set.id}</small>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {!loading && filteredQuestions.length > 0 && (
        <div className="question-list-section">
          <strong>単問</strong>
          <div className="question-list">
            {filteredQuestions.map((question) => (
              <article className="question-list-item" key={question.id}>
                <div>
                  <h3>{question.title}</h3>
                  <p>{questionPreview(question)}</p>
                  <small>{question.id}</small>
                </div>
                <dl>
                  <div>
                    <dt>教科</dt>
                    <dd>{question.subject}</dd>
                  </div>
                  <div>
                    <dt>単元</dt>
                    <dd>{question.unitId}</dd>
                  </div>
                  <div>
                    <dt>出典</dt>
                    <dd>{sourceLabel(question.source.type)}</dd>
                  </div>
                  <div>
                    <dt>状態</dt>
                    <dd>{statusLabel(question.reviewStatus)}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
