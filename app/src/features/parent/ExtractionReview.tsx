import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ExtractionCandidate, ExtractionResult, PromotionForm } from "../../domain/extraction";
import type { Question } from "../../domain/question";
import { PromotionEditor } from "./PromotionEditor";
import { RegionEditModal } from "./RegionEditModal";

function defaultPromotionForm(candidate: ExtractionCandidate, ocrText: string): PromotionForm {
  return {
    questionId: `imported-${candidate.candidateId}`,
    subject: "国語",
    unitId: "kanji-import",
    skillIds: "kanji-writing",
    questionType: candidate.suggestedQuestionType === "unknown" ? "free-text" : candidate.suggestedQuestionType,
    title: `ページ ${candidate.page} の取り込み問題`,
    body: ocrText,
    note: "OCR 候補から昇格",
    answerValue: "",
    purposes: "learning,review",
  };
}

export function ExtractionReview({
  initialResult,
  extractionPath,
  setImportError,
  sourceDocumentId,
}: {
  initialResult: ExtractionResult;
  extractionPath: string | null;
  setImportError: (value: string | null) => void;
  sourceDocumentId: string;
}) {
  const [result, setResult] = useState(initialResult);
  const [candidateTexts, setCandidateTexts] = useState<Record<string, string>>(
    () => Object.fromEntries(initialResult.candidates.map((c) => [c.candidateId, c.ocrText])),
  );
  const [reviewingCandidateId, setReviewingCandidateId] = useState<string | null>(null);
  const [promotedQuestionIds, setPromotedQuestionIds] = useState<string[]>([]);
  const [promotionForms, setPromotionForms] = useState<Record<string, PromotionForm>>({});
  const [promotingCandidateId, setPromotingCandidateId] = useState<string | null>(null);
  const [regionEditCandidate, setRegionEditCandidate] = useState<ExtractionCandidate | null>(null);

  // Single-pass count instead of three separate .filter() calls
  const counts = result.candidates.reduce(
    (acc, c) => {
      if (c.reviewStatus === "adult-approved") acc.approved++;
      else if (c.reviewStatus === "suspended") acc.suspended++;
      else acc.draft++;
      return acc;
    },
    { approved: 0, suspended: 0, draft: 0 },
  );

  function promotionFormFor(candidate: ExtractionCandidate): PromotionForm {
    return (
      promotionForms[candidate.candidateId] ??
      defaultPromotionForm(candidate, candidateTexts[candidate.candidateId] ?? candidate.ocrText)
    );
  }

  function updatePromotionForm(candidateId: string, patch: Partial<PromotionForm>) {
    setPromotionForms((current) => {
      const candidate = result.candidates.find((item) => item.candidateId === candidateId);
      if (!candidate) return current;
      // Use current (updater arg) rather than outer closure to avoid stale reads
      const existing =
        current[candidateId] ??
        defaultPromotionForm(candidate, candidateTexts[candidateId] ?? candidate.ocrText);
      return { ...current, [candidateId]: { ...existing, ...patch } };
    });
  }

  async function reviewCandidate(
    candidate: ExtractionCandidate,
    reviewStatus: ExtractionCandidate["reviewStatus"],
  ) {
    setReviewingCandidateId(candidate.candidateId);
    setImportError(null);
    try {
      setResult(
        await invoke<ExtractionResult>("review_extraction_candidate", {
          sourceDocumentId,
          candidateId: candidate.candidateId,
          ocrText: candidateTexts[candidate.candidateId] ?? candidate.ocrText,
          reviewStatus,
        }),
      );
    } catch (caught) {
      setImportError(String(caught));
    } finally {
      setReviewingCandidateId(null);
    }
  }

  async function promoteCandidate(candidate: ExtractionCandidate) {
    const form = promotionFormFor(candidate);
    setPromotingCandidateId(candidate.candidateId);
    setImportError(null);
    try {
      const question = await invoke<Question>("promote_extraction_candidate", {
        input: {
          sourceDocumentId,
          candidateId: candidate.candidateId,
          questionId: form.questionId,
          subject: form.subject,
          unitId: form.unitId,
          skillIds: form.skillIds.split(",").map((v) => v.trim()).filter(Boolean),
          questionType: form.questionType,
          title: form.title,
          body: form.body,
          note: form.note,
          answerValue: form.answerValue,
          purposes: form.purposes.split(",").map((v) => v.trim()).filter(Boolean),
        },
      });
      setPromotedQuestionIds((current) => [...new Set([...current, question.id])]);
    } catch (caught) {
      setImportError(String(caught));
    } finally {
      setPromotingCandidateId(null);
    }
  }

  return (
    <>
    <section className="extraction-review">
      <div className="import-success">
        <p>
          {result.candidates.length} 件の候補を作成しました。
          {result.pageCount > 0 && ` ${result.pageCount} ページを処理しました。`}
        </p>
        <p className="review-counts">
          draft: {counts.draft} 件 / 承認済み: {counts.approved} 件 / 保留: {counts.suspended} 件
        </p>
        {extractionPath && (
          <p className="extraction-path">
            保存場所: <code>{extractionPath}</code>
          </p>
        )}
        <small>
          ここでの承認は OCR 候補の確認です。答えと単元を設定するまで出題には使いません。OCR
          を再実行するとレビュー内容は上書きされます。
        </small>
      </div>

      <div className="candidate-list">
        {result.candidates.map((candidate) => {
          // Compute form once per candidate — used for both form prop and isPromoted check
          const form = promotionFormFor(candidate);
          return (
            <details
              className={`candidate-card ${candidate.reviewStatus}`}
              key={candidate.candidateId}
            >
              <summary>
                <strong>
                  ページ {candidate.page}
                  {candidate.itemLabel ? ` / ${candidate.itemLabel}` : ""}
                </strong>
                <span>{candidate.suggestedQuestionType}</span>
                <span>信頼度 {Math.round(candidate.confidence * 100)}%</span>
                <em>
                  {candidate.reviewStatus === "adult-approved"
                    ? "承認済み"
                    : candidate.reviewStatus === "suspended"
                      ? "保留"
                      : "draft"}
                </em>
              </summary>
              <textarea
                aria-label={`${candidate.candidateId} の OCR 本文`}
                rows={6}
                value={candidateTexts[candidate.candidateId] ?? candidate.ocrText}
                onChange={(event) =>
                  setCandidateTexts((current) => ({
                    ...current,
                    [candidate.candidateId]: event.currentTarget.value,
                  }))
                }
              />
              <div className="candidate-actions">
                <button
                  className="small-button"
                  disabled={reviewingCandidateId === candidate.candidateId}
                  type="button"
                  onClick={() => reviewCandidate(candidate, "adult-approved")}
                >
                  承認
                </button>
                <button
                  className="secondary-button"
                  disabled={reviewingCandidateId === candidate.candidateId}
                  type="button"
                  onClick={() => reviewCandidate(candidate, "suspended")}
                >
                  保留
                </button>
                {candidate.reviewStatus !== "draft" && (
                  <button
                    className="text-button"
                    disabled={reviewingCandidateId === candidate.candidateId}
                    type="button"
                    onClick={() => reviewCandidate(candidate, "draft")}
                  >
                    draft に戻す
                  </button>
                )}
                <button
                  className="text-button"
                  type="button"
                  onClick={() => setRegionEditCandidate(candidate)}
                >
                  領域を再指定
                </button>
              </div>
              {candidate.reviewStatus === "adult-approved" ? (
                <PromotionEditor
                  candidate={candidate}
                  form={form}
                  isPromoted={promotedQuestionIds.includes(form.questionId)}
                  isPromoting={promotingCandidateId === candidate.candidateId}
                  promoteCandidate={promoteCandidate}
                  updatePromotionForm={updatePromotionForm}
                />
              ) : (
                <p className="promotion-hint">
                  Question へ昇格するには、まず OCR 候補を承認してください。
                </p>
              )}
            </details>
          );
        })}
      </div>
    </section>

    {regionEditCandidate && (
      <RegionEditModal
        candidate={regionEditCandidate}
        extractionPath={extractionPath}
        sourceDocumentId={sourceDocumentId}
        onClose={() => setRegionEditCandidate(null)}
        onUpdated={(updatedResult) => {
          setResult(updatedResult);
          const updated = updatedResult.candidates.find(
            (c) => c.candidateId === regionEditCandidate.candidateId,
          );
          if (updated) {
            setCandidateTexts((current) => ({
              ...current,
              [updated.candidateId]: updated.ocrText,
            }));
          }
        }}
      />
    )}
    </>
  );
}
