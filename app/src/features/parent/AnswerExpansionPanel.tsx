import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Question, AnswerExpansionOutcome } from "../../domain/question";

type Props = {
  question: Question;
  onClose: () => void;
  onSaved: () => void;
};

type SelectionRow = {
  value: string;
  isOriginal: boolean;
  isCanonical: boolean;
  isAccepted: boolean;
};

export function AnswerExpansionPanel({ question, onClose, onSaved }: Props) {
  const [outcomes, setOutcomes] = useState<AnswerExpansionOutcome[]>([]);
  const [rows, setRows] = useState<SelectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const value = question.answer.value ?? "";
    invoke<AnswerExpansionOutcome[]>("apply_answer_expansion_rules", {
      answerValue: value,
    })
      .then((result) => {
        setOutcomes(result);
        const allValues: string[] = [];
        for (const outcome of result) {
          for (const c of outcome.candidates) {
            if (!allValues.includes(c.value)) allValues.push(c.value);
          }
        }
        // Original value appended if not already in candidates
        const original = value;
        if (!allValues.includes(original)) allValues.push(original);

        setRows(
          allValues.map((v, i) => ({
            value: v,
            isOriginal: v === original,
            isCanonical: i === 0,
            isAccepted: false,
          })),
        );
      })
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [question.id, question.answer.value]);

  function setCanonical(value: string) {
    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        isCanonical: row.value === value,
        // canonical and accepted are mutually exclusive
        isAccepted: row.value === value ? false : row.isAccepted,
      })),
    );
  }

  function toggleAccepted(value: string) {
    setRows((prev) =>
      prev.map((row) =>
        row.value === value
          ? { ...row, isAccepted: !row.isAccepted, isCanonical: row.isCanonical && !row.isAccepted ? false : row.isCanonical }
          : row,
      ),
    );
  }

  async function handleSave() {
    const canonicalRow = rows.find((r) => r.isCanonical);
    const answerValue = canonicalRow?.value ?? question.answer.value ?? "";
    const acceptedAnswers = rows.filter((r) => r.isAccepted).map((r) => r.value);
    setSaving(true);
    setError(null);
    try {
      await invoke("update_question_answer", {
        questionId: question.id,
        answerValue,
        acceptedAnswers,
      });
      onSaved();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="expansion-panel">
        <p className="expansion-panel-loading">候補を確認中…</p>
      </div>
    );
  }

  if (outcomes.length === 0) {
    return (
      <div className="expansion-panel">
        <p className="expansion-panel-empty">一致するルールがありませんでした。</p>
        <button type="button" className="text-button" onClick={onClose}>
          閉じる
        </button>
      </div>
    );
  }

  const outcome = outcomes[0];

  return (
    <div className="expansion-panel">
      <div className="expansion-panel-header">
        <div>
          <strong className="expansion-panel-rule">{outcome.ruleName}</strong>
          <p className="expansion-panel-description">{outcome.ruleDescription}</p>
        </div>
        <button
          type="button"
          className="text-button"
          onClick={onClose}
          aria-label="閉じる"
        >
          ✕
        </button>
      </div>

      <p className="expansion-panel-original">
        取込値: <code>{outcome.originalValue}</code>
      </p>

      <table className="expansion-panel-table">
        <thead>
          <tr>
            <th>標準正答</th>
            <th>許容回答</th>
            <th>値</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.value} className={row.isOriginal ? "expansion-row-original" : ""}>
              <td>
                <input
                  type="radio"
                  name={`canonical-${question.id}`}
                  checked={row.isCanonical}
                  onChange={() => setCanonical(row.value)}
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  checked={row.isAccepted}
                  disabled={row.isCanonical}
                  onChange={() => toggleAccepted(row.value)}
                />
              </td>
              <td>
                <span className="expansion-row-value">{row.value}</span>
                {row.isOriginal && (
                  <span className="expansion-row-tag">取込値</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {error && <p className="expansion-panel-error">{error}</p>}

      <div className="expansion-panel-actions">
        <button
          type="button"
          className="primary-button"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "保存中…" : "保存"}
        </button>
        <button type="button" className="text-button" onClick={onClose}>
          スキップ
        </button>
      </div>
    </div>
  );
}
