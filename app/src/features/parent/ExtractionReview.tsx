import { useState } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import type {
  AnswerCandidate,
  AnswerLink,
  ExtractionCandidate,
  ExtractionResult,
  PromotionForm,
  SuggestedAnswer,
} from "../../domain/extraction";
import type { Question } from "../../domain/question";
import { PromotionEditor } from "./PromotionEditor";
import { RegionEditModal } from "./RegionEditModal";

function artifactImageUrl(
  extractionPath: string | null,
  sourceDocumentId: string,
  imagePath: string | undefined,
): string | null {
  if (!extractionPath || !imagePath) return null;
  const extractionDir = extractionPath.replace(/[/\\]extraction-result\.json$/i, "");
  const sep = extractionDir.includes("\\") ? "\\" : "/";
  const normalized = imagePath.replace(/\\/g, "/");
  const marker = `content/extractions/${sourceDocumentId}/`;
  const relativeInsideExtraction = normalized.includes(marker)
    ? normalized.slice(normalized.indexOf(marker) + marker.length)
    : normalized.split("/").slice(-1)[0] ?? normalized;

  return convertFileSrc(`${extractionDir}${sep}${relativeInsideExtraction.replace(/\//g, sep)}`);
}

function answerTextFromSuggestion(suggestion: SuggestedAnswer | undefined): string {
  return suggestion?.value?.trim() ?? "";
}

function bestAnswerSuggestion(link: AnswerLink | undefined, answer: AnswerCandidate | undefined) {
  return link?.suggestedAnswer ?? answer?.suggestedAnswer;
}

function labelForAnswer(answer: AnswerCandidate, index: number): string {
  const item = answer.itemLabel ? ` / ${answer.itemLabel}` : "";
  return `候補 ${index + 1}: P${answer.page}${item}`;
}

function defaultPromotionForm(candidate: ExtractionCandidate, ocrText: string): PromotionForm {
  const subjectStr = candidate.suggestedSubject ? `【${candidate.suggestedSubject}】` : "";
  const itemStr = candidate.itemLabel ? ` 問${candidate.itemLabel}` : "";

  return {
    questionId: `imported-${candidate.candidateId}`,
    subject: candidate.suggestedSubject || "",
    unitId: candidate.suggestedUnitId || "",
    skillIds: "",
    questionType: candidate.suggestedQuestionType || "numeric",
    presentationType: "source-region",
    title: `${subjectStr}P${candidate.page}${itemStr} の問題`,
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
  const [candidateFeedback, setCandidateFeedback] = useState<Record<string, { type: 'success' | 'error', message: string }>>({});
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string | undefined>>(() => {
    const links = initialResult.answerLinks ?? [];
    return Object.fromEntries(
      initialResult.candidates.map((candidate) => {
        const firstLink = links
          .filter((link) => link.candidateId === candidate.candidateId)
          .sort((a, b) => b.confidence - a.confidence)[0];
        return [candidate.candidateId, firstLink?.answerCandidateId];
      }),
    );
  });

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
      promotionForms[candidate.candidateId] ||
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

  function selectAnswerCandidate(candidate: ExtractionCandidate, answerCandidateId: string | undefined) {
    setSelectedAnswers((current) => ({ ...current, [candidate.candidateId]: answerCandidateId }));
    const answer = result.answerCandidates?.find((item) => item.answerCandidateId === answerCandidateId);
    const link = result.answerLinks?.find(
      (item) => item.candidateId === candidate.candidateId && item.answerCandidateId === answerCandidateId,
    );
    const suggested = bestAnswerSuggestion(link, answer);
    const value = answerTextFromSuggestion(suggested) || answer?.ocrText.trim() || "";
    updatePromotionForm(candidate.candidateId, {
      answerCandidateId,
      ...(value ? { answerValue: value } : {}),
      note: answerCandidateId ? "OCR 候補から昇格。問題と解答の対応付けを確認済み。" : "OCR 候補から昇格",
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

  async function reextractCandidateWithAi(candidate: ExtractionCandidate) {
    setReviewingCandidateId(candidate.candidateId);
    setCandidateFeedback((current) => {
      const next = { ...current };
      delete next[candidate.candidateId];
      return next;
    });
    setImportError(null);
    try {
      const updatedResult = await invoke<ExtractionResult>("reextract_candidate_with_ai", {
        sourceDocumentId,
        candidateId: candidate.candidateId,
      });
      setResult(updatedResult);
      const updatedCandidate = updatedResult.candidates.find(
        (c) => c.candidateId === candidate.candidateId
      );
      if (updatedCandidate) {
        setCandidateTexts((current) => ({
          ...current,
          [candidate.candidateId]: updatedCandidate.ocrText,
        }));
        setCandidateFeedback((current) => ({
          ...current,
          [candidate.candidateId]: { type: 'success', message: 'AI による再読み込みが完了しました。' }
        }));
      }
    } catch (caught) {
      setCandidateFeedback((current) => ({
        ...current,
        [candidate.candidateId]: { type: 'error', message: String(caught) }
      }));
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
          presentationType: form.presentationType,
          title: form.title,
          body: form.body,
          note: form.note,
          answerValue: form.answerValue,
          answerCandidateId: form.answerCandidateId,
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
          const answerLinks = (result.answerLinks ?? [])
            .filter((link) => link.candidateId === candidate.candidateId)
            .sort((a, b) => b.confidence - a.confidence);
          const linkedAnswerIds = new Set(answerLinks.map((link) => link.answerCandidateId));
          const answerCandidates = (result.answerCandidates ?? [])
            .filter((answer) => linkedAnswerIds.has(answer.answerCandidateId))
            .sort((a, b) => {
              const aLink = answerLinks.find((link) => link.answerCandidateId === a.answerCandidateId);
              const bLink = answerLinks.find((link) => link.answerCandidateId === b.answerCandidateId);
              return (bLink?.confidence ?? b.confidence) - (aLink?.confidence ?? a.confidence);
            });
          const selectedAnswerId = selectedAnswers[candidate.candidateId] ?? answerCandidates[0]?.answerCandidateId;
          const selectedAnswer = answerCandidates.find((answer) => answer.answerCandidateId === selectedAnswerId);
          const selectedLink = answerLinks.find((link) => link.answerCandidateId === selectedAnswerId);
          const selectedSuggestion = bestAnswerSuggestion(selectedLink, selectedAnswer);
          const questionImageUrl = artifactImageUrl(extractionPath, sourceDocumentId, candidate.regionImagePath);
          const answerImageUrl = artifactImageUrl(
            extractionPath,
            sourceDocumentId,
            selectedAnswer?.regionImagePath,
          );
          const requiresAnswerPair = (result.answerCandidates?.length ?? 0) > 0;
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
              {answerCandidates.length > 0 && (
                <section className="answer-pair-review" aria-label="問題と解答の対応確認">
                  <div className="pair-review-header">
                    <div>
                      <strong>問題と解答の左右比較</strong>
                      <span>
                        P{candidate.page}
                        {candidate.itemLabel ? ` / ${candidate.itemLabel}` : ""}
                        {selectedAnswer ? ` → P${selectedAnswer.page}` : ""}
                      </span>
                    </div>
                    <label>
                      <span>解答候補</span>
                      <select
                        value={selectedAnswerId ?? ""}
                        onChange={(event) => selectAnswerCandidate(candidate, event.currentTarget.value || undefined)}
                      >
                        {answerCandidates.map((answer, index) => (
                          <option key={answer.answerCandidateId} value={answer.answerCandidateId}>
                            {labelForAnswer(answer, index)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="pair-review-grid">
                    <article className="pair-pane">
                      <div className="pair-pane-title">
                        <strong>問題画像</strong>
                        <span>信頼度 {Math.round(candidate.confidence * 100)}%</span>
                      </div>
                      {questionImageUrl ? (
                        <img src={questionImageUrl} alt={`問題候補 ${candidate.candidateId}`} />
                      ) : (
                        <p className="pair-empty">問題の切り出し画像がありません。</p>
                      )}
                      <pre>{candidateTexts[candidate.candidateId] ?? candidate.ocrText}</pre>
                    </article>

                    <article className="pair-pane answer-pane">
                      <div className="pair-pane-title">
                        <strong>解答画像</strong>
                        <span>
                          {selectedLink
                            ? `紐づけ ${Math.round(selectedLink.confidence * 100)}%`
                            : selectedAnswer
                              ? `信頼度 ${Math.round(selectedAnswer.confidence * 100)}%`
                              : "未選択"}
                        </span>
                      </div>
                      {answerImageUrl ? (
                        <img src={answerImageUrl} alt={`解答候補 ${selectedAnswer?.answerCandidateId ?? ""}`} />
                      ) : (
                        <p className="pair-empty">解答の切り出し画像がありません。</p>
                      )}
                      <pre>{selectedAnswer?.ocrText ?? "解答候補を選択してください。"}</pre>
                      {selectedSuggestion && (
                        <div className="suggested-answer-box">
                          <span>推定正答</span>
                          <strong>{selectedSuggestion.value}</strong>
                          <small>{selectedSuggestion.source} / {Math.round(selectedSuggestion.confidence * 100)}%</small>
                        </div>
                      )}
                      {selectedLink?.matchReason && selectedLink.matchReason.length > 0 && (
                        <div className="match-reasons">
                          {selectedLink.matchReason.map((reason) => (
                            <span key={reason}>{reason}</span>
                          ))}
                        </div>
                      )}
                    </article>
                  </div>

                  <div className="pair-review-actions">
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={!selectedAnswer}
                      onClick={() => selectAnswerCandidate(candidate, selectedAnswer?.answerCandidateId)}
                    >
                      この解答を答え欄へ反映
                    </button>
                  </div>
                </section>
              )}
              {requiresAnswerPair && answerCandidates.length === 0 && (
                <p className="pair-empty">
                  解答候補はありますが、この問題への紐づけ候補がありません。手動で対応付けるまで承認できません。
                </p>
              )}
              <div className="candidate-actions">
                <button
                  className="small-button"
                  disabled={
                    reviewingCandidateId === candidate.candidateId ||
                    (requiresAnswerPair && !selectedAnswer)
                  }
                  type="button"
                  onClick={() => reviewCandidate(candidate, "adult-approved")}
                  title={requiresAnswerPair && !selectedAnswer ? "解答候補との対応を選んでから承認してください" : undefined}
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
                <button
                  className="outline-button"
                  disabled={reviewingCandidateId === candidate.candidateId}
                  type="button"
                  onClick={() => reextractCandidateWithAi(candidate)}
                >
                  {reviewingCandidateId === candidate.candidateId ? "処理中..." : "AIで読み直す"}
                </button>
              </div>
              {candidateFeedback[candidate.candidateId] && (
                <div style={{
                  padding: '0.5rem',
                  marginTop: '0.5rem',
                  fontSize: '0.9rem',
                  borderRadius: '4px',
                  backgroundColor: candidateFeedback[candidate.candidateId].type === 'error' ? '#fdecea' : '#edf7ed',
                  color: candidateFeedback[candidate.candidateId].type === 'error' ? '#d32f2f' : '#1e4620',
                  border: `1px solid ${candidateFeedback[candidate.candidateId].type === 'error' ? '#f5c2c7' : '#c3e6cb'}`
                }}>
                  {candidateFeedback[candidate.candidateId].message}
                </div>
              )}
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
        pages={result.pages}
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
            // Drop the stale promotion form so it regenerates from the new OCR text.
            // Safe: re-extraction resets reviewStatus to "draft" so the promotion
            // editor is not visible until the adult re-approves.
            setPromotionForms((current) => {
              const { [updated.candidateId]: _dropped, ...rest } = current;
              return rest;
            });
          }
        }}
      />
    )}
    </>
  );
}
