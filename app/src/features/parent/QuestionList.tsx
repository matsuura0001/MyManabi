import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Question } from "../../domain/question";

const purposeLabel: Record<string, string> = {
  learning: "学習",
  review: "復習",
  assessment: "評価",
};

const typeLabel: Record<string, string> = {
  numeric: "数値",
  kanji: "漢字",
  "multiple-choice": "選択",
  "word-problem": "文章題",
  "free-text": "自由記述",
  handwriting: "手書き",
  speech: "スピーキング",
};

export function QuestionList() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    invoke<Question[]>("load_question_bank")
      .then((loaded) => {
        setQuestions(loaded);
        setLoading(false);
      })
      .catch((err) => {
        setError(String(err));
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <section className="parent-card question-list-card">
        <p className="eyebrow">問題バンク</p>
        <p>読み込み中...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="parent-card question-list-card">
        <p className="eyebrow">問題バンク</p>
        <p className="import-error">問題を読み込めませんでした: {error}</p>
      </section>
    );
  }

  if (questions.length === 0) {
    return (
      <section className="parent-card question-list-card">
        <p className="eyebrow">問題バンク</p>
        <h2>確認済みの問題はまだありません</h2>
        <p>教材を取り込んで問題をプロモーションすると、ここに表示されます。</p>
      </section>
    );
  }

  return (
    <section className="parent-card question-list-card">
      <p className="eyebrow">問題バンク</p>
      <h2>{questions.length} 件の確認済み問題</h2>
      <table className="question-list-table">
        <thead>
          <tr>
            <th>タイトル</th>
            <th>教科</th>
            <th>単元</th>
            <th>種別</th>
            <th>用途</th>
            <th>承認</th>
          </tr>
        </thead>
        <tbody>
          {questions.map((question) => (
            <tr key={question.id}>
              <td>
                <span className="question-list-title">{question.title}</span>
                {question.body && (
                  <p className="question-list-body">{question.body}</p>
                )}
              </td>
              <td>{question.subject}</td>
              <td>{question.unitId}</td>
              <td>{typeLabel[question.questionType] ?? question.questionType}</td>
              <td>{question.purposes.map((p) => purposeLabel[p] ?? p).join("・")}</td>
              <td>
                <span className={`review-chip review-chip--${question.reviewStatus}`}>
                  {question.reviewStatus === "adult-approved" ? "大人確認" : "自動承認"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
