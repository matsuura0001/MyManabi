import type { ExtractionCandidate, PromotionForm } from "../../domain/extraction";

export function PromotionEditor({
  candidate,
  form,
  isPromoted,
  isPromoting,
  promoteCandidate,
  updatePromotionForm,
}: {
  candidate: ExtractionCandidate;
  form: PromotionForm;
  isPromoted: boolean;
  isPromoting: boolean;
  promoteCandidate: (candidate: ExtractionCandidate) => Promise<void>;
  updatePromotionForm: (candidateId: string, patch: Partial<PromotionForm>) => void;
}) {
  const { candidateId } = candidate;
  const update = (patch: Partial<PromotionForm>) => updatePromotionForm(candidateId, patch);

  return (
    <section className="promotion-editor">
      <p className="eyebrow">Question JSON へ昇格</p>
      <div className="promotion-grid">
        <label>
          <span>Question ID</span>
          <input
            value={form.questionId}
            onChange={(e) => update({ questionId: e.currentTarget.value })}
          />
        </label>
        <label>
          <span>教科</span>
          <input
            value={form.subject}
            onChange={(e) => update({ subject: e.currentTarget.value })}
          />
        </label>
        <label>
          <span>単元 ID</span>
          <input
            value={form.unitId}
            onChange={(e) => update({ unitId: e.currentTarget.value })}
          />
        </label>
        <label>
          <span>Skill IDs（カンマ区切り）</span>
          <input
            value={form.skillIds}
            onChange={(e) => update({ skillIds: e.currentTarget.value })}
          />
        </label>
        <label>
          <span>問題種別</span>
          <select
            value={form.questionType}
            onChange={(e) => update({ questionType: e.currentTarget.value })}
          >
            <option value="free-text">free-text</option>
            <option value="kanji">kanji</option>
            <option value="numeric">numeric</option>
            <option value="multiple-choice">multiple-choice</option>
            <option value="word-problem">word-problem</option>
            <option value="handwriting">handwriting</option>
            <option value="speech">speech</option>
          </select>
        </label>
        <label>
          <span>用途（カンマ区切り）</span>
          <input
            value={form.purposes}
            onChange={(e) => update({ purposes: e.currentTarget.value })}
          />
        </label>
      </div>
      <label className="wide-field">
        <span>タイトル</span>
        <input value={form.title} onChange={(e) => update({ title: e.currentTarget.value })} />
      </label>
      <label className="wide-field">
        <span>問題文</span>
        <textarea
          rows={5}
          value={form.body}
          onChange={(e) => update({ body: e.currentTarget.value })}
        />
      </label>
      <label className="wide-field">
        <span>答え</span>
        <input
          placeholder="出題に使うため必須"
          value={form.answerValue}
          onChange={(e) => update({ answerValue: e.currentTarget.value })}
        />
      </label>
      <label className="wide-field">
        <span>メモ</span>
        <input value={form.note} onChange={(e) => update({ note: e.currentTarget.value })} />
      </label>
      <button
        className="small-button"
        disabled={isPromoting || isPromoted || form.answerValue.trim() === ""}
        type="button"
        onClick={() => promoteCandidate(candidate)}
      >
        {isPromoted ? "昇格済み" : isPromoting ? "保存中..." : "Question JSON に保存"}
      </button>
    </section>
  );
}
