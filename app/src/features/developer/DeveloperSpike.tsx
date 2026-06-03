import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { SpikeOutcome } from "../../domain/question";

const DEFAULT_PROMPT = "小学3年生向けの足し算の問題を1問だけ、答え付きで作ってください。";

export function DeveloperSpike() {
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
