import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { SpikeOutcome, Question } from "../../domain/question";
import type { PlayableItem } from "./types";
import { expectedAnswerForQuestion, questionSetExpectedAnswers } from "../../domain/importReview.mjs";

type AiChatPanelProps = {
  currentProblem: PlayableItem | undefined;
  allQuestions: Question[];
  answers: Record<string, string>;
};

export function AiChatPanel({ currentProblem, allQuestions, answers }: AiChatPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [imagePaths, setImagePaths] = useState<string[]>([]);
  const [outcome, setOutcome] = useState<SpikeOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleSetContext() {
    if (!currentProblem) return;
    
    let contextText = "以下の問題について質問します。\n\n";
    const paths: string[] = [];

    if (currentProblem.type === "single") {
      const q = currentProblem.data;
      contextText += `【問題文】\n${q.title}\n`;
      if (q.body) contextText += `${q.body}\n`;
      if (q.presentation?.text) contextText += `${q.presentation.text}\n`;
      if (q.presentation?.imagePath) {
        contextText += `(画像も送信しました)\n`;
        paths.push(q.presentation.imagePath);
      }
      
      const expected = expectedAnswerForQuestion(q);
      contextText += `\n【想定解】\n${expected}\n`;
      
      const userAnswer = answers[q.id];
      if (userAnswer !== undefined) {
        contextText += `\n【学習者の解答】\n${userAnswer}\n`;
      }
    } else {
      const set = currentProblem.data;
      contextText += `【大問】\n`;
      contextText += `(複数の小問からなる問題セット)\n`;
      
      const expectedAnswers = questionSetExpectedAnswers(set, allQuestions);
      
      set.items.forEach((item, i) => {
        const q = allQuestions.find(x => x.id === item.questionId);
        if (q) {
          contextText += `\n--- 小問 ${i + 1} ---\n`;
          contextText += `問題: ${q.title}\n`;
          if (q.body) contextText += `${q.body}\n`;
          if (q.presentation?.text) contextText += `${q.presentation.text}\n`;
          if (q.presentation?.imagePath) {
            contextText += `(画像も送信しました)\n`;
            paths.push(q.presentation.imagePath);
          }
          const expected = expectedAnswers[i]?.value ?? "";
          contextText += `想定解: ${expected}\n`;
          const fullAnswer = answers[set.id] || "";
          const lines = fullAnswer.split('\n');
          const userAnswer = lines[i];
          if (userAnswer !== undefined && userAnswer.trim() !== "") {
             contextText += `学習者の解答 (該当箇所): ${userAnswer}\n`;
          }
        }
      });
    }

    setPrompt((prev) => prev ? `${contextText}\n\n---\n\n${prev}` : `${contextText}\n\n`);
    setImagePaths((prev) => {
      const newPaths = [...prev];
      for (const p of paths) {
        if (!newPaths.includes(p)) newPaths.push(p);
      }
      return newPaths;
    });
  }

  async function askAi() {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setOutcome(null);
    try {
      setOutcome(await invoke<SpikeOutcome>("codex_spike", { prompt, imagePaths }));
    } catch (caught) {
      setError(String(caught));
    } finally {
      setLoading(false);
    }
  }

  return (
    <aside className="ai-chat-panel">
      <div className="ai-chat-header">
        <strong>AI に 質問</strong>
        <button type="button" onClick={handleSetContext} disabled={!currentProblem}>
          この問題を AI に質問する
        </button>
      </div>
      <textarea 
        value={prompt} 
        onChange={(event) => setPrompt(event.currentTarget.value)} 
        rows={6} 
        placeholder="AIへの質問を入力してください..."
      />
      <div className="ai-chat-actions">
        <button type="button" onClick={askAi} disabled={loading || !prompt.trim()}>
          {loading ? "送信中..." : "質問を送信"}
        </button>
      </div>
      {error && <pre className="error">エラー: {error}</pre>}
      {outcome && (
        <div className="ai-chat-result">
          <div className="ai-chat-meta">
            {outcome.accountEmail ?? "(不明)"} / {outcome.planType ?? "(不明)"} /{" "}
            {outcome.model ?? "(既定モデル)"}
          </div>
          <pre className="ai-chat-text">{outcome.problemText}</pre>
        </div>
      )}
    </aside>
  );
}
