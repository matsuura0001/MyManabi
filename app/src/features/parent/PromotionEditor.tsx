import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ExtractionCandidate, PromotionForm } from "../../domain/extraction";
import type {
  ProposedItem,
  SplitOutcome,
  AnswerSplitEvaluationCase,
  RuleSplitCandidate,
  LocalSplitOutcome,
} from "../../domain/evaluation";

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
  
  // Active split result
  const [isSplitting, setIsSplitting] = useState(false);
  const [splitItems, setSplitItems] = useState<ProposedItem[] | null>(null);
  const [unassignedText, setUnassignedText] = useState("");
  const [evaluationSaved, setEvaluationSaved] = useState(false);

  // Split provenance — tracks where the current splitItems came from
  const [splitSource, setSplitSource] = useState<"rule" | "ai" | "manual" | null>(null);
  const [originalRuleItems, setOriginalRuleItems] = useState<ProposedItem[] | null>(null);
  const [appliedRuleCandidate, setAppliedRuleCandidate] = useState<RuleSplitCandidate | null>(null);
  const [originalAiItems, setOriginalAiItems] = useState<ProposedItem[] | null>(null);

  // Rule-based split state
  const [isRuleSplitting, setIsRuleSplitting] = useState(false);
  const [ruleSplitCandidates, setRuleSplitCandidates] = useState<RuleSplitCandidate[] | null>(null);

  const handleRuleSplit = async () => {
    if (!form.answerValue.trim()) return;
    setIsRuleSplitting(true);
    setRuleSplitCandidates(null);
    try {
      const outcome = await invoke<LocalSplitOutcome>("apply_local_split_rules", {
        answerText: form.answerValue,
      });
      setRuleSplitCandidates(outcome.candidates);
    } catch (e) {
      alert(`ルール分割に失敗しました: ${e}`);
    } finally {
      setIsRuleSplitting(false);
    }
  };

  const adoptRuleCandidate = (candidate: RuleSplitCandidate) => {
    setSplitItems(candidate.items);
    setOriginalRuleItems(candidate.items);
    setAppliedRuleCandidate(candidate);
    setSplitSource("rule");
    setUnassignedText(candidate.unassignedText);
    setRuleSplitCandidates(null);
    setEvaluationSaved(false);
  };

  const handleAiSplit = async () => {
    if (!form.answerValue) return;
    setIsSplitting(true);
    setEvaluationSaved(false);
    try {
      const outcome = await invoke<SplitOutcome>("split_answer_text", { answerText: form.answerValue });
      setSplitItems(outcome.items);
      setOriginalAiItems(outcome.items);
      setSplitSource("ai");
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
    if (!splitItems) return;
    const originalForSource = splitSource === "rule" ? originalRuleItems : originalAiItems;
    const isUnmodified =
      originalForSource !== null &&
      JSON.stringify(originalForSource) === JSON.stringify(splitItems);
    const evaluationCase: AnswerSplitEvaluationCase = {
      id: `split-${candidateId}-${Date.now()}`,
      inputText: form.answerValue,
      expectedItemCount: splitItems.length,
      ruleOutput: originalRuleItems ?? [],
      aiOutput: originalAiItems ?? [],
      finalItems: splitItems,
      status: isUnmodified ? "accepted" : splitSource ? "corrected" : "corrected",
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
              onClick={handleRuleSplit}
              disabled={isRuleSplitting || isSplitting || !form.answerValue.trim()}
            >
              {isRuleSplitting ? "検出中..." : "ルールで自動分割"}
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
                const newItem = { label: `問${current.length + 1}`, value: "", confidence: 1.0 };
                setSplitItems([...current, newItem]);
                if (!splitSource) setSplitSource("manual");
              }}
            >
              手動で小問を追加
            </button>
          </div>
          
          {ruleSplitCandidates !== null && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: '#f0f4ff', borderRadius: '4px', border: '1px solid #c5d0e6' }}>
              <strong>分割候補</strong>
              {ruleSplitCandidates.length === 0 ? (
                <div style={{ marginTop: '0.5rem' }}>
                  <p style={{ color: '#555', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                    既知のパターンが見つかりませんでした。AI に分割を依頼しますか？
                  </p>
                  <button
                    type="button"
                    className="outline-button"
                    disabled={isSplitting}
                    onClick={() => {
                      setRuleSplitCandidates(null);
                      handleAiSplit();
                    }}
                  >
                    {isSplitting ? "AIで分割中..." : "AIで小問に分割"}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                  {ruleSplitCandidates.map((cand) => (
                    <div
                      key={cand.ruleId}
                      style={{ background: '#fff', border: '1px solid #c5d0e6', borderRadius: '4px', padding: '0.75rem' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.4rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{cand.ruleName}</span>
                        <small style={{ color: '#666' }}>{cand.ruleDescription}</small>
                      </div>
                      <div style={{ display: 'grid', gap: '0.2rem', marginBottom: '0.6rem' }}>
                        {cand.items.map((item) => (
                          <span key={item.label} style={{ fontSize: '0.85rem', fontFamily: 'monospace' }}>
                            {item.label}: <strong>{item.value || '（空）'}</strong>
                          </span>
                        ))}
                        {cand.unassignedText && (
                          <small style={{ color: '#888' }}>未割り当て: {cand.unassignedText}</small>
                        )}
                      </div>
                      <button
                        type="button"
                        className="small-button"
                        onClick={() => adoptRuleCandidate(cand)}
                      >
                        この分割を採用
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ marginTop: '0.75rem' }}>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setRuleSplitCandidates(null)}
                  style={{ color: '#666', fontSize: '0.85rem' }}
                >
                  閉じる
                </button>
              </div>
            </div>
          )}

          {splitItems && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: '#f8f9fa', borderRadius: '4px' }}>
              <strong>小問の確認と修正</strong>
              {appliedRuleCandidate && (
                <small style={{ marginLeft: '0.5rem', color: '#555' }}>
                  （{appliedRuleCandidate.ruleName} 適用済み）
                </small>
              )}
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
                    setOriginalRuleItems(null);
                    setOriginalAiItems(null);
                    setAppliedRuleCandidate(null);
                    setSplitSource(null);
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
