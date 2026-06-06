import { useEffect, useMemo, useState } from "react";
import type { Question } from "../../domain/question";
import type { QuestionSet } from "../../domain/questionSet";
import { AnswerExpansionPanel } from "./AnswerExpansionPanel";
import { QuestionSetDetailModal } from "./QuestionSetDetailModal";
import { QuestionDetailModal } from "./QuestionDetailModal";
import { sourceLabel, statusLabel } from "./labels";

type QuestionListProps = {
  loading: boolean;
  questions: Question[];
  questionSets: QuestionSet[];
  query: string;
  setQuery: (query: string) => void;
  error: string | null;
  refresh: () => Promise<void>;
};

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
  // Find the item with the lowest order without sorting the whole array.
  const firstItem = set.items.reduce<typeof set.items[0] | undefined>(
    (min, item) => (min === undefined || item.order < min.order ? item : min),
    undefined
  );
  const firstQuestion = firstItem && questionsById.get(firstItem.questionId);
  return firstQuestion ? `${firstQuestion.title} ほか` : set.id;
}

/** Client-side pre-check: does this answer value match any expansion rule? */
function hasExpansionCandidates(question: Question): boolean {
  const val = question.answer.value;
  if (!val) return false;
  // remainder-r-to-japanese
  if (/(?<![a-zA-Z])\d+\s*[rR]\s*\d+(?![a-zA-Z])/.test(val)) return true;
  // fraction-to-japanese: N/M where N, M < 100 (avoids dates/URLs)
  if (/(?<![:/])\b(\d{1,2})\/(\d{1,2})\b/.test(val)) return true;
  // trailing-zero-decimal: e.g. 3.0 or 5.00
  if (/\d+\.0+$/.test(val.trim())) return true;
  return false;
}

const ITEMS_PER_PAGE = 50;

export function QuestionList({
  loading,
  questions,
  questionSets,
  query,
  setQuery,
  error,
  refresh,
}: QuestionListProps) {
  const [expandingId, setExpandingId] = useState<string | null>(null);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  
  const [questionsPage, setQuestionsPage] = useState(1);
  const [setsPage, setSetsPage] = useState(1);
  const [subjectFilter, setSubjectFilter] = useState("");
  const [unitFilter, setUnitFilter] = useState("");

  const subjects = useMemo(
    () => Array.from(new Set(questions.map((q) => q.subject))).filter(Boolean),
    [questions]
  );
  const units = useMemo(
    () => Array.from(new Set(questions.map((q) => q.unitId))).filter(Boolean),
    [questions]
  );

  useEffect(() => {
    setQuestionsPage(1);
    setSetsPage(1);
  }, [query, subjectFilter, unitFilter]);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const questionsById = useMemo(
    () => new Map(questions.map((question) => [question.id, question])),
    [questions]
  );
  const filteredQuestions = useMemo(
    () =>
      questions.filter((question) => {
        if (subjectFilter && question.subject !== subjectFilter) return false;
        if (unitFilter && question.unitId !== unitFilter) return false;
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
      }),
    [questions, normalizedQuery, subjectFilter, unitFilter]
  );
  const filteredSets = useMemo(
    () =>
      questionSets.filter((set) => {
        if (subjectFilter || unitFilter) {
          const hasMatchingQuestion = set.items.some((item) => {
            const q = questionsById.get(item.questionId);
            if (!q) return false;
            if (subjectFilter && q.subject !== subjectFilter) return false;
            if (unitFilter && q.unitId !== unitFilter) return false;
            return true;
          });
          if (!hasMatchingQuestion) return false;
        }
        if (!normalizedQuery) return true;
        const childText = set.items
          .map((item) => questionsById.get(item.questionId))
          .filter(Boolean)
          .map((question) => `${question?.title} ${question?.body ?? ""}`)
          .join(" ");
        return `${set.id} ${set.source.type} ${childText}`
          .toLocaleLowerCase()
          .includes(normalizedQuery);
      }),
    [questionSets, questionsById, normalizedQuery, subjectFilter, unitFilter]
  );
  const needsExpansionCount = useMemo(
    () => (normalizedQuery ? 0 : questions.filter(hasExpansionCandidates).length),
    [questions, normalizedQuery]
  );

  const paginatedSets = useMemo(() => {
    const start = (setsPage - 1) * ITEMS_PER_PAGE;
    return filteredSets.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredSets, setsPage]);

  const paginatedQuestions = useMemo(() => {
    const start = (questionsPage - 1) * ITEMS_PER_PAGE;
    return filteredQuestions.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredQuestions, questionsPage]);

  // TODO: 将来的には、親コンポーネントが questions を全件メモリに抱える設計自体を見直し、バックエンド連携によるサーバサイドページネーションへの移行を検討する


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
        <label>
          <span>教科</span>
          <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
            <option value="">すべて</option>
            {subjects.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          <span>単元</span>
          <select value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)}>
            <option value="">すべて</option>
            {units.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </label>
        <div className="question-list-counts" aria-live="polite">
          <strong>{questions.length}</strong>
          <span>単問</span>
          <strong>{questionSets.length}</strong>
          <span>セット</span>
        </div>
      </div>

      {needsExpansionCount > 0 && !normalizedQuery && (
        <div className="expansion-notice">
          <span className="expansion-notice-badge">{needsExpansionCount}</span>
          問の答えに展開候補があります。各問題の「答え展開候補」ボタンで確認できます。
        </div>
      )}

      {error && <p className="question-list-error">{error}</p>}
      {loading && <p className="question-list-empty">問題を読み込んでいます。</p>}

      {!loading && !error && filteredQuestions.length === 0 && filteredSets.length === 0 && (
        <p className="question-list-empty">条件に合う問題はありません。</p>
      )}

      {!loading && filteredSets.length > 0 && (
        <div className="question-list-section">
          <strong>問題セット</strong>
          <div className="question-list">
            {paginatedSets.map((set) => (
              <article
                className="question-list-item set-item"
                key={set.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedSetId(set.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedSetId(set.id);
                  }
                }}
              >
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
          {filteredSets.length > ITEMS_PER_PAGE && (
            <div className="question-list-pagination">
              <button
                type="button"
                className="text-button"
                disabled={setsPage === 1}
                onClick={() => setSetsPage((p) => p - 1)}
              >
                前へ
              </button>
              <span>
                {setsPage} / {Math.ceil(filteredSets.length / ITEMS_PER_PAGE)}
              </span>
              <button
                type="button"
                className="text-button"
                disabled={setsPage >= Math.ceil(filteredSets.length / ITEMS_PER_PAGE)}
                onClick={() => setSetsPage((p) => p + 1)}
              >
                次へ
              </button>
            </div>
          )}
        </div>
      )}

      {!loading && filteredQuestions.length > 0 && (
        <div className="question-list-section">
          <strong>単問</strong>
          <div className="question-list">
            {paginatedQuestions.map((question) => {
              const needsExpansion = hasExpansionCandidates(question);
              const isExpanding = expandingId === question.id;
              return (
                <article
                  className={`question-list-item${isExpanding ? " question-list-item--expanding" : ""}`}
                  key={question.id}
                >
                  <div>
                    <h3>{question.title}</h3>
                    <p>{questionPreview(question)}</p>
                    <small>{question.id}</small>
                    <div className="question-actions">
                      <button
                        type="button"
                        className="detail-trigger"
                        onClick={() => setSelectedQuestionId(question.id)}
                      >
                        詳細を確認
                      </button>
                      {needsExpansion && !isExpanding && (
                        <button
                          type="button"
                          className="expansion-trigger"
                          onClick={() => setExpandingId(question.id)}
                        >
                          答え展開候補を確認
                        </button>
                      )}
                    </div>
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
                    {question.answer.value && (
                      <div>
                        <dt>答え</dt>
                        <dd className="answer-value-cell">
                          {question.answer.value}
                          {question.answer.acceptedAnswers?.length ? (
                            <span className="answer-accepted-count">
                              +{question.answer.acceptedAnswers.length}
                            </span>
                          ) : null}
                        </dd>
                      </div>
                    )}
                  </dl>
                  {isExpanding && (
                    <div className="expansion-panel-wrapper">
                      <AnswerExpansionPanel
                        question={question}
                        onClose={() => setExpandingId(null)}
                        onSaved={async () => {
                          setExpandingId(null);
                          await refresh();
                        }}
                      />
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          {filteredQuestions.length > ITEMS_PER_PAGE && (
            <div className="question-list-pagination">
              <button
                type="button"
                className="text-button"
                disabled={questionsPage === 1}
                onClick={() => setQuestionsPage((p) => p - 1)}
              >
                前へ
              </button>
              <span>
                {questionsPage} / {Math.ceil(filteredQuestions.length / ITEMS_PER_PAGE)}
              </span>
              <button
                type="button"
                className="text-button"
                disabled={questionsPage >= Math.ceil(filteredQuestions.length / ITEMS_PER_PAGE)}
                onClick={() => setQuestionsPage((p) => p + 1)}
              >
                次へ
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {selectedSetId && (
        <QuestionSetDetailModal
          questionSet={questionSets.find((s) => s.id === selectedSetId)!}
          questions={questions}
          onClose={() => setSelectedSetId(null)}
        />
      )}

      {selectedQuestionId && (
        <QuestionDetailModal
          question={questions.find((q) => q.id === selectedQuestionId)!}
          parentQuestionSet={questionSets.find(
            (s) => s.items.some((item) => item.questionId === selectedQuestionId)
          )}
          onClose={() => setSelectedQuestionId(null)}
        />
      )}
    </section>
  );
}
