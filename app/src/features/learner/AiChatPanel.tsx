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

type Message = {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
};

export function AiChatPanel({ currentProblem, allQuestions, answers }: AiChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState("");
  const [imagePaths, setImagePaths] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleSetContextAndAsk() {
    if (!currentProblem) return;
    
    let contextText = "以下の問題について解説をお願いします。\n\n";
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
      contextText += `【大問】\n(複数の小問からなる問題セット)\n`;
      
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

    askAi("この問題の解説と、私の解答がなぜ間違っているか（合っているか）を教えてください。", contextText, paths);
  }

  async function askAi(newMessageContent: string, contextText?: string, additionalImagePaths: string[] = []) {
    if (!newMessageContent.trim() && !contextText) return;
    
    setLoading(true);
    setError(null);

    const newMessages = [...messages];
    if (contextText) {
      newMessages.push({ id: crypto.randomUUID(), role: "system", content: contextText });
    }
    if (newMessageContent) {
      newMessages.push({ id: crypto.randomUUID(), role: "user", content: newMessageContent });
    }
    setMessages(newMessages);
    setPrompt("");

    const currentImagePaths = Array.from(new Set([...imagePaths, ...additionalImagePaths]));
    setImagePaths(currentImagePaths);

    const fullPrompt = newMessages.map(m => {
       if (m.role === "system") return `[System Context]\n${m.content}`;
       if (m.role === "user") return `User: ${m.content}`;
       return `Assistant: ${m.content}`;
    }).join("\n\n");

    try {
      const outcome = await invoke<SpikeOutcome>("codex_spike", { prompt: fullPrompt, imagePaths: currentImagePaths });
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: "assistant", content: outcome.problemText }]);
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
        <button type="button" onClick={handleSetContextAndAsk} disabled={!currentProblem || loading}>
          この問題を AI に質問する
        </button>
      </div>

      <div className="ai-chat-messages">
        {messages.map(m => (
          <div key={m.id} className={`ai-message-bubble ${m.role}`}>
            {m.role === "system" ? (
              <details>
                <summary>送信された問題データ (クリックで表示)</summary>
                <pre>{m.content}</pre>
              </details>
            ) : (
              <pre>{m.content}</pre>
            )}
          </div>
        ))}
        {loading && <div className="ai-message-bubble loading">AIが回答を作成中...</div>}
        {error && <div className="error">エラー: {error}</div>}
      </div>

      <div className="ai-chat-input-area">
        <textarea 
          value={prompt} 
          onChange={(event) => setPrompt(event.currentTarget.value)} 
          rows={2} 
          placeholder="追加の質問を入力..."
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              askAi(prompt);
            }
          }}
        />
        <button type="button" onClick={() => askAi(prompt)} disabled={loading || !prompt.trim()}>
          送信
        </button>
      </div>
    </aside>
  );
}
