import { useState } from "react";
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
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <section className="promotion-editor">
      <p className="eyebrow">Question JSON へ昇格</p>

      {/* 必須設定（出題に直結） */}
      <fieldset className="primary-settings">
        <legend>出題設定（必須）</legend>
        
        <label className="wide-field">
          <span>タイトル</span>
          <input value={form.title} onChange={(e) => update({ title: e.currentTarget.value })} />
        </label>
        
        <div className="promotion-grid">
          <label>
            <span>教科</span>
            <input
              value={form.subject}
              onChange={(e) => update({ subject: e.currentTarget.value })}
            />
          </label>
          <label>
            <span>出題の表示形式</span>
            <select
              value={form.presentationType}
              onChange={(e) => update({ presentationType: e.currentTarget.value as any })}
            >
              <option value="source-region">画像（対象領域のみ表示） / source-region</option>
              <option value="source-page">画像（ページ全体を表示） / source-page</option>
              <option value="normalized">テキスト（抽出文面を表示） / normalized</option>
            </select>
          </label>
          <label>
            <span>問題種別</span>
            <select
              value={form.questionType}
              onChange={(e) => update({ questionType: e.currentTarget.value })}
            >
              <option value="numeric">数値回答（numeric）</option>
              <option value="free-text">自由記述（free-text）</option>
              <option value="multiple-choice">選択式（multiple-choice）</option>
              <option value="kanji">漢字（kanji）</option>
              <option value="word-problem">文章題（word-problem）</option>
              <option value="handwriting">手書き（handwriting）</option>
              <option value="speech">音声（speech）</option>
            </select>
          </label>
        </div>

        {form.presentationType === "normalized" && (
          <label className="wide-field">
            <span>問題文（テキスト）</span>
            <textarea
              rows={5}
              value={form.body}
              onChange={(e) => update({ body: e.currentTarget.value })}
            />
          </label>
        )}

        <label className="wide-field">
          <span>答え</span>
          <textarea
            rows={3}
            placeholder="出題時の答え合わせに使うため必須です"
            value={form.answerValue}
            onChange={(e) => update({ answerValue: e.currentTarget.value })}
          />
        </label>
      </fieldset>

      {/* 詳細設定 */}
      <details className="advanced-settings" open={showAdvanced} onToggle={(e) => setShowAdvanced(e.currentTarget.open)}>
        <summary>詳細設定（メタデータ・内部ID）</summary>
        <div className="promotion-grid">
          <label>
            <span>単元 ID（自動推測）</span>
            <input
              disabled
              value={form.unitId || "（未指定）"}
              className="disabled-text"
              title="編集は単元設定画面から行います"
            />
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
          <span>メモ</span>
          <input value={form.note} onChange={(e) => update({ note: e.currentTarget.value })} />
        </label>
      </details>

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
