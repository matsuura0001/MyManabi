import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ExtractionCandidate, PromotionForm } from "../../domain/extraction";
import type { ProposedItem, SplitOutcome, AnswerSplitEvaluationCase } from "../../domain/evaluation";

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
  promoteCandidate: (candidate: ExtractionCandidate, splitItems: ProposedItem[] | null) => Promise<void>;
  updatePromotionForm: (candidateId: string, patch: Partial<PromotionForm>) => void;
}) {
  const { candidateId } = candidate;
  const update = (patch: Partial<PromotionForm>) => updatePromotionForm(candidateId, patch);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // AI Split UI state
  const [isSplitting, setIsSplitting] = useState(false);
  const [splitItems, setSplitItems] = useState<ProposedItem[] | null>(null);
  const [unassignedText, setUnassignedText] = useState("");
  const [originalSplitItems, setOriginalSplitItems] = useState<ProposedItem[] | null>(null);
  const [evaluationSaved, setEvaluationSaved] = useState(false);

  const handleAiSplit = async () => {
    if (!form.answerValue) return;
    setIsSplitting(true);
    setEvaluationSaved(false);
    try {
      const outcome = await invoke<SplitOutcome>("split_answer_text", { answerText: form.answerValue });
      setSplitItems(outcome.items);
      setOriginalSplitItems(outcome.items);
      setUnassignedText(outcome.unassignedText || "");
    } catch (e) {
      alert(`AI分割に失敗しました: ${e}`);
    } finally {
      setIsSplitting(false);
    }
  };

  const updateSplitItem = (index: number, value: string) => {
    if (!splitItems) return;
    const newItems = [...splitItems];
    newItems[index] = { ...newItems[index], value };
    setSplitItems(newItems);
  };

  const handleSaveEvaluation = async () => {
    if (!splitItems || !originalSplitItems) return;
    const evaluationCase: AnswerSplitEvaluationCase = {
      id: `split-${candidateId}-${Date.now()}`,
      inputText: form.answerValue,
      expectedItemCount: splitItems.length,
      ruleOutput: [], // ローカルルールは今回は省略
      aiOutput: originalSplitItems,
      finalItems: splitItems,
      status: "corrected"
    };

    try {
      await invoke("save_answer_split_evaluation", { case: evaluationCase });
      setEvaluationSaved(true);
    } catch (e) {
      alert(`評価ハーネスの保存に失敗しました: ${e}`);
    }
  };

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

        <div className="wide-field">
          <span>答え</span>
          <textarea
            rows={3}
            placeholder="出題時の答え合わせに使うため必須です"
            value={form.answerValue}
            onChange={(e) => update({ answerValue: e.currentTarget.value })}
          />
          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              className="outline-button"
              onClick={() => {
                // 将来的にローカルルール分割処理をここに差し込む
                // 例: const result = applyLocalSplitRules(form.answerValue);
                // setSplitItems(result);
                alert("ローカルルールでの自動分割は今後実装予定です");
              }}
              disabled={isSplitting || !form.answerValue.trim()}
            >
              ルールで自動分割
            </button>
            <button 
              type="button" 
              className="outline-button" 
              onClick={handleAiSplit} 
              disabled={isSplitting || !form.answerValue.trim()}
            >
              {isSplitting ? "AIで分割中..." : "AIで小問に分割"}
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                const current = splitItems || [];
                setSplitItems([...current, { label: `問${current.length + 1}`, value: "", confidence: 1.0 }]);
                if (!originalSplitItems) setOriginalSplitItems([...current, { label: `問${current.length + 1}`, value: "", confidence: 1.0 }]);
              }}
            >
              手動で小問を追加
            </button>
          </div>
          
          {splitItems && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: '#f8f9fa', borderRadius: '4px' }}>
              <strong>小問の確認と修正</strong>
              <div style={{ display: 'grid', gap: '0.5rem', marginTop: '0.5rem' }}>
                {splitItems.map((item, i) => (
                  <label key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input 
                      type="text" 
                      value={item.label} 
                      onChange={(e) => {
                        const newItems = [...splitItems];
                        newItems[i] = { ...newItems[i], label: e.target.value };
                        setSplitItems(newItems);
                      }}
                      style={{ width: '80px' }}
                    />
                    <input 
                      type="text" 
                      value={item.value} 
                      onChange={(e) => updateSplitItem(i, e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <small>({Math.round(item.confidence * 100)}%)</small>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => {
                        const newItems = splitItems.filter((_, index) => index !== i);
                        setSplitItems(newItems.length > 0 ? newItems : null);
                      }}
                      style={{ color: '#d32f2f', padding: '0 0.5rem' }}
                      title="この小問を削除"
                    >
                      ×
                    </button>
                  </label>
                ))}
              </div>
              {unassignedText && (
                <div style={{ marginTop: '0.5rem', color: '#666' }}>
                  <small>未割り当て: {unassignedText}</small>
                </div>
              )}
              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                <button 
                  type="button" 
                  className="small-button" 
                  onClick={handleSaveEvaluation}
                  disabled={evaluationSaved}
                >
                  {evaluationSaved ? "ハーネスに保存済み" : "分割結果を評価ハーネスとして記録"}
                </button>
                <button
                  type="button"
                  className="small-button text-button"
                  onClick={() => {
                    setSplitItems(null);
                    setOriginalSplitItems(null);
                    setUnassignedText("");
                  }}
                  style={{ color: '#d32f2f' }}
                >
                  小問分割をキャンセル
                </button>
              </div>
            </div>
          )}
        </div>
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
        className="primary-button"
        disabled={isPromoting || isPromoted || form.answerValue.trim() === ""}
        type="button"
        onClick={() => promoteCandidate(candidate, splitItems)}
      >
        {isPromoting ? "保存中..." : isPromoted ? "保存済み" : splitItems ? "QuestionSet として保存" : "Question JSON に保存"}
      </button>
    </section>
  );
}
