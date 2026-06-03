import type { Question } from "../domain/question";

export const fallbackProblems: Question[] = [
  {
    id: "prototype-fraction-story-01",
    subject: "算数",
    unitId: "fraction-addition",
    skillIds: ["same-denominator-addition"],
    questionType: "word-problem",
    title: "文章を読んで、式と答えを書いてみよう",
    body: "ジュースが 3/8 L あります。そこへ 2/8 L を足しました。ジュースは全部で何 L になりましたか。",
    note: "前に学んだ「同分母のたし算」の確認です",
    answer: { type: "exact-text", value: "5/8 L" },
    source: { type: "adult-authored" },
    reviewStatus: "adult-approved",
    purposes: ["learning", "review"],
  },
  {
    id: "prototype-fraction-basic-01",
    subject: "算数",
    unitId: "fraction-addition",
    skillIds: ["same-denominator-addition"],
    questionType: "numeric",
    title: "図を見ながら考えてみよう",
    body: "3/8 + 2/8 = ?",
    note: "あとで解くこともできます",
    answer: { type: "exact-text", value: "5/8" },
    source: { type: "adult-authored" },
    reviewStatus: "adult-approved",
    purposes: ["learning", "review"],
  },
];
